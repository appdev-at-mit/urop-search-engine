"""
Resume–project relevance: given a PDF resume and a list of projects,
return projects ranked by relevance of the resume's major to the project's department.

Ranking strategy (3 steps):
  1. Extract the student's major from the EDUCATION section of the resume.
  2. Classify each UROP's department into one or more majors.
  3. Projects whose department maps to the student's major are ranked first;
     the remaining projects are ranked after by TF-IDF + LSA similarity.
"""

from pathlib import Path
import re
import json

import pdfplumber
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.decomposition import TruncatedSVD
import numpy as np
import matplotlib.pyplot as plt


# ---------------------------------------------------------------------------
# Department → major mapping
# Add / edit entries here to cover more MIT departments.
# Each department string (lowercased, partial match) maps to a set of majors.
# ---------------------------------------------------------------------------
DEPARTMENT_TO_MAJORS: dict[str, list[str]] = {
    # Computer Science / EECS
    "computer science":            ["computer science"],
    "eecs":                        ["computer science", "electrical engineering"],
    "csail":                       ["computer science"],
    "artificial intelligence":     ["computer science"],
    "machine learning":            ["computer science"],
    "software":                    ["computer science"],
    "computing":                   ["computer science"],
    "information":                 ["computer science"],

    # Electrical Engineering
    "electrical engineering":      ["electrical engineering", "computer science"],
    "electronics":                 ["electrical engineering"],
    "signal processing":           ["electrical engineering"],
    "circuits":                    ["electrical engineering"],
    "rle":                         ["electrical engineering", "physics"],

    # Mechanical Engineering
    "mechanical engineering":      ["mechanical engineering"],
    "robotics":                    ["mechanical engineering", "computer science"],
    "aerospace":                   ["mechanical engineering", "physics"],
    "manufacturing":               ["mechanical engineering"],
    "thermodynamics":              ["mechanical engineering", "physics"],

    # Biology / Biological Engineering
    "biology":                     ["biology"],
    "biological engineering":      ["biology"],
    "biochemistry":                ["biology", "chemistry"],
    "neuroscience":                ["biology", "brain and cognitive sciences"],
    "genomics":                    ["biology"],
    "microbiology":                ["biology"],
    "life sciences":               ["biology"],
    "bioinformatics":              ["biology", "computer science"],

    # Brain and Cognitive Sciences
    "brain and cognitive":         ["brain and cognitive sciences"],
    "brain cognitive":             ["brain and cognitive sciences"],
    "cognitive science":           ["brain and cognitive sciences"],
    "bcs":                         ["brain and cognitive sciences"],
    "neurology":                   ["brain and cognitive sciences", "biology"],

    # Chemistry / Chemical Engineering
    "chemistry":                   ["chemistry"],
    "chemical engineering":        ["chemistry"],

    # Physics
    "physics":                     ["physics"],
    "nuclear":                     ["physics", "nuclear science"],
    "plasma":                      ["physics"],
    "astrophysics":                ["physics"],

    # Mathematics
    "mathematics":                 ["mathematics"],
    "applied mathematics":         ["mathematics"],
    "statistics":                  ["mathematics"],
    "operations research":         ["mathematics", "economics"],

    # Economics / Management
    "economics":                   ["economics"],
    "sloan":                       ["economics", "management"],
    "management":                  ["economics"],
    "finance":                     ["economics"],

    # Earth / Environmental
    "earth":                       ["earth science"],
    "ocean":                       ["earth science"],
    "environmental":               ["earth science"],
    "climate":                     ["earth science"],
    "geology":                     ["earth science"],

    # Architecture / Urban
    "architecture":                ["architecture"],
    "urban":                       ["urban studies"],
    "urban studies":               ["urban studies"],
    "planning":                    ["urban studies"],

    # Humanities / Social Sciences
    "history":                     ["humanities"],
    "literature":                  ["humanities"],
    "linguistics":                 ["humanities", "brain and cognitive sciences"],
    "political":                   ["social science"],
    "sociology":                   ["social science"],
    "anthropology":                ["social science"],
    "humanities":                  ["humanities"],
    "science technology society":  ["humanities", "social science"],
    "sts":                         ["humanities", "social science"],

    # Materials Science
    "materials science":           ["materials science"],
    "materials":                   ["materials science"],
}


def _extract_text_from_pdf(resume_path: str) -> str:
    """Extract and normalize all text from a PDF resume."""
    path = Path(resume_path)
    if not path.exists():
        raise FileNotFoundError(f"Resume PDF not found: {resume_path}")
    if not path.suffix.lower() == ".pdf":
        raise ValueError(f"Expected a PDF file, got: {resume_path}")
    try:
        with pdfplumber.open(path) as pdf:
            parts = [page.extract_text() for page in pdf.pages if page.extract_text()]
        raw = "\n".join(parts)
    except Exception as e:
        raise ValueError(f"Invalid or unreadable PDF: {resume_path}") from e
    return "\n".join(raw.splitlines())  # preserve line breaks for section detection


def _extract_education_section(resume_text: str) -> str:
    """
    Pull out just the EDUCATION section from the resume text.
    Looks for a header line containing 'education' and reads until
    the next all-caps / title-case section header.
    """
    lines = resume_text.splitlines()
    in_education = False
    education_lines = []

    for line in lines:
        stripped = line.strip()

        # Detect the EDUCATION header
        if re.match(r'^(EDUCATION|Education)[\s:]*$', stripped):
            in_education = True
            continue

        if in_education:
            if stripped:
                education_lines.append(stripped)
            # Stop after the first 2 non-empty lines
            if len(education_lines) >= 2:
                break

    return " ".join(education_lines)


def _extract_major_from_resume(resume_path: str) -> str:
    """
    Step 1: Extract the student's major from the EDUCATION section of the resume.

    Strategy:
    - Isolate the EDUCATION section.
    - Search for explicit labels (Major, Field of Study, Concentration, B.S./B.A. in X).
    - Fall back to scanning for known major names in that section.
    Returns a lowercase major string, e.g. 'computer science'.
    """
    resume_text = _extract_text_from_pdf(resume_path)
    education_text = _extract_education_section(resume_text)

    print(f"[DEBUG] Education section: {education_text[:300]!r}")

    search_text = (education_text if education_text else resume_text).lower()

    # Strategy 1: match known majors directly against the education text.
    # Longest match first so "computer science" beats plain "science".
    # Word-boundary matching prevents "science" from matching inside "computer science".
    all_known_majors = sorted(
        {m for majors in DEPARTMENT_TO_MAJORS.values() for m in majors},
        key=len, reverse=True
    )
    for major in all_known_majors:
        if re.search(r'\b' + re.escape(major) + r'\b', search_text):
            print(f"[DEBUG] Major detected via known-major scan: '{major}'")
            return major

    # Strategy 2: fallback regex for majors not in the lookup table
    label_patterns = [
        # "Bachelor/Master of Science/Arts/Engineering in X" — skips the degree-type word
        r'(?:Bachelor|Master)\s+of\s+(?:Science|Arts|Engineering)\s+in\s+([A-Za-z &/]{3,60})',
        # "B.S. in X" / "S.B. in X"
        r'(?:B\.?S\.?|B\.?A\.?|M\.?S\.?|M\.?Eng\.?|S\.B\.)\s+in\s+([A-Za-z &/]{3,60})',
        r'Major[:\s]+([A-Za-z &/]{3,60})',
        r'Concentration[:\s]+([A-Za-z &/]{3,60})',
    ]
    for pattern in label_patterns:
        match = re.search(pattern, search_text, re.IGNORECASE)
        if match:
            major = match.group(1).strip()
            major = re.split(r'\b(?:at|from|gpa|expected|graduation|class|minor|with|,)\b',
                             major, flags=re.IGNORECASE)[0].strip()
            major = re.sub(r'\b(in|of|the|and|or)\b', ' ', major, flags=re.IGNORECASE)
            major = re.sub(r'\s+', ' ', major).strip().lower()
            if major:
                print(f"[DEBUG] Major detected via label pattern: '{major}'")
                return major

    print("[DEBUG] Could not detect major from resume.")
    return ""


def _classify_department(department: str) -> list[str]:
    """
    Step 2: Map a project's department string to a list of majors.
    Uses partial substring matching against DEPARTMENT_TO_MAJORS keys.
    Returns a list of matching major strings (may be empty).
    """
    dept_lower = department.lower()
    matched_majors = set()
    for keyword, majors in DEPARTMENT_TO_MAJORS.items():
        if keyword in dept_lower:
            matched_majors.update(majors)
    return list(matched_majors)


def _project_to_text(project: dict, keys: tuple = ("department", "title", "description", "keywords")) -> str:
    """Concatenate relevant project fields into one string for TF-IDF."""
    parts = [str(project[k]).strip() for k in keys if project.get(k)]
    return " ".join(parts)


def plot_LSA(svd):
    singular_values = svd.singular_values_
    explained = svd.explained_variance_ratio_
    cumulative = np.cumsum(explained)

    plt.figure(figsize=(6, 4))
    plt.plot(singular_values, marker='o')
    plt.title("SVD Singular Values (LSA)")
    plt.xlabel("Component"); plt.ylabel("Singular value")
    plt.show()

    plt.figure(figsize=(6, 4))
    plt.plot(explained, marker='o')
    plt.title("Explained Variance Ratio per Component")
    plt.xlabel("Component"); plt.ylabel("Explained variance")
    plt.show()

    plt.figure(figsize=(6, 4))
    plt.plot(cumulative, marker='o')
    plt.axhline(0.8, linestyle="--")
    plt.title("Cumulative Explained Variance")
    plt.xlabel("Component"); plt.ylabel("Cumulative variance")
    plt.show()


def find_most_relevant_LSA(
    resume_path: str,
    projects: list[dict],
    top_k: int = 10,
    project_text_keys: tuple = ("department", "title", "description", "keywords"),
    show_lsa_plots: bool = False,
) -> tuple[list[dict], np.ndarray]:
    """
    Rank UROPs by relevance to the student's resume major.

    Step 1 — Extract major from the EDUCATION section of the resume.
    Step 2 — Classify each project's department into majors.
    Step 3 — Projects matching the student's major come first (sorted by
              TF-IDF/LSA score within that group); non-matching projects follow.

    Returns:
        (results, full_index_order)
        results: top_k project dicts, each with an added 'score' and 'major_match' field.
    """
    if not projects:
        return [], np.array([])

    # ---- Step 1: identify major ----
    resume_major = _extract_major_from_resume(resume_path)
    print(f"[INFO] Student major: '{resume_major}'")

    # ---- Step 2: classify each project ----
    for p in projects:
        p["_majors"] = _classify_department(p.get("department", ""))

    # ---- TF-IDF + LSA for within-group ordering ----
    resume_text = _extract_text_from_pdf(resume_path)
    project_texts = [_project_to_text(p, project_text_keys) for p in projects]
    all_docs = [resume_text] + project_texts

    vectorizer = TfidfVectorizer(
        max_features=10_000,
        stop_words="english",
        ngram_range=(1, 2),
        min_df=1,
        max_df=0.95,
    )
    X = vectorizer.fit_transform(all_docs)
    n_components = min(70, X.shape[1] - 1)
    svd = TruncatedSVD(n_components=n_components, algorithm="randomized",
                       n_iter=10, random_state=42)
    X_semantic = svd.fit_transform(X)

    if show_lsa_plots:
        plot_LSA(svd)
    else:
        cumulative = np.cumsum(svd.explained_variance_ratio_)
        print(f"[INFO] Cumulative explained variance ({n_components} components): {cumulative[-1]:.3f}")

    resume_vec = X_semantic[0:1]
    project_matrix = X_semantic[1:]
    similarities = cosine_similarity(resume_vec, project_matrix).ravel()

    # ---- Step 3: split into matching vs non-matching, sort each by LSA score ----
    matching     = []  # department maps to student's major
    nonmatching  = []  # everything else

    for i, project in enumerate(projects):
        entry = (i, float(similarities[i]))
        if resume_major and resume_major in project["_majors"]:
            matching.append(entry)
        else:
            nonmatching.append(entry)

    matching.sort(key=lambda x: x[1], reverse=True)
    nonmatching.sort(key=lambda x: x[1], reverse=True)

    ranked = matching + nonmatching
    full_indices = np.array([i for i, _ in ranked])

    result = []
    for i, score in ranked[:top_k]:
        item = dict(projects[i])
        item["score"]       = round(score, 6)
        item["major_match"] = resume_major in item.pop("_majors", [])
        result.append(item)

    # Clean up temp field from original list
    for p in projects:
        p.pop("_majors", None)

    return result, full_indices


if __name__ == "__main__":
<<<<<<< HEAD
    base_dir = Path(__file__).resolve().parent
    sample_resume = base_dir / "sample_resume.pdf"
    sample_projects = base_dir / "sample_projects.json"
=======
    sample_resume   = r"C:/Users/neha_/OneDrive/Documents/MIT/urop_finder_2/urop-search-engine/Relevance/resume.pdf"
    sample_projects = r"C:/Users/neha_/OneDrive/Documents/MIT/urop_finder_2/urop-search-engine/Relevance/sample_projects.json"
>>>>>>> main

    with sample_projects.open("r", encoding="utf-8") as f:
        projects = json.load(f)

<<<<<<< HEAD
    results, indices = find_most_relevant_LSA(str(sample_resume), projects, top_k=5)
=======
    results, indices = find_most_relevant_LSA(sample_resume, projects, top_k=10)
    print()
>>>>>>> main
    for r in results:
        match_flag = "✓" if r["major_match"] else " "
        print(f"[{match_flag}] {r['score']:.4f}  {r['department']:<40}  {r['title']}")