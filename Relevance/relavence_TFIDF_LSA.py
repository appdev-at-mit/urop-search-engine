"""
Resume–project relevance: given a PDF resume and a list of projects,
return projects ranked by relevance (TF-IDF + cosine similarity).
"""

from pathlib import Path

import pdfplumber
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.decomposition import TruncatedSVD
import json
import numpy as np
import matplotlib.pyplot as plt

# Default text fields used to build searchable project text
PROJECT_TEXT_KEYS = ("title", "description", "requirements")


def _extract_text_from_pdf(resume_path: str) -> str:
    """Extract and normalize text from a PDF resume. Raises on missing/invalid file."""
    path = Path(resume_path)
    if not path.exists():
        raise FileNotFoundError(f"Resume PDF not found: {resume_path}")
    if not path.suffix.lower() == ".pdf":
        raise ValueError(f"Expected a PDF file, got: {resume_path}")

    try:
        with pdfplumber.open(path) as pdf:
            parts = []
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    parts.append(text)
            raw = "\n".join(parts) if parts else ""
    except Exception as e:
        raise ValueError(f"Invalid or unreadable PDF: {resume_path}") from e

    # Normalize whitespace to a single space
    return " ".join(raw.split()) if raw else ""


def _project_to_text(project: dict, keys: tuple[str, ...] = PROJECT_TEXT_KEYS) -> str:
    """Build one searchable string from relevant project fields. Skips missing keys."""
    parts = []
    for key in keys:
        val = project.get(key)
        if val is not None and isinstance(val, str):
            parts.append(val.strip())
    return " ".join(parts) if parts else ""


def plot_LSA(svd):
    singular_values = svd.singular_values_
    explained = svd.explained_variance_ratio_
    cumulative = np.cumsum(explained)

    plt.figure(figsize=(6,4))
    plt.plot(singular_values, marker='o')
    plt.title("SVD Singular Values (LSA)")
    plt.xlabel("Component")
    plt.ylabel("Singular value")
    plt.show()

    plt.figure(figsize=(6,4))
    plt.plot(explained, marker='o')
    plt.title("Explained Variance Ratio per Component")
    plt.xlabel("Component")
    plt.ylabel("Explained variance")
    plt.show()

    plt.figure(figsize=(6,4))
    plt.plot(cumulative, marker='o')
    plt.axhline(0.8, linestyle="--")
    plt.title("Cumulative Explained Variance")
    plt.xlabel("Component")
    plt.ylabel("Cumulative variance")
    plt.show()

def find_most_relevant_LSA(
    resume_path: str,
    projects: list[dict],
    top_k: int = 10,
    project_text_keys: tuple[str, ...] = PROJECT_TEXT_KEYS,
    plot_LSA: bool = False
) -> list[dict]:
    """
    Rank projects by relevance to the given PDF resume.

    Args:
        resume_path: Path to the PDF resume file.
        projects: List of project dicts with at least some of title, description, requirements.
        top_k: Maximum number of projects to return (default 10).
        project_text_keys: Keys to use for project text (default: title, description, requirements).

    Returns:
        List of project dicts (with an added "score" field), best first. Length <= top_k.
    """
    if not projects:
        return []

    resume_text = _extract_text_from_pdf(resume_path)
    project_texts = [_project_to_text(p, project_text_keys) for p in projects]

    # Fit TF-IDF on resume + all project texts so vocabulary includes both
    all_docs = [resume_text] + project_texts
    vectorizer = TfidfVectorizer(
        max_features=10_000,
        stop_words="english",
        ngram_range=(1, 2),
        min_df=1,
        max_df=0.95,
    )
    X = vectorizer.fit_transform(all_docs)
    svd = TruncatedSVD(
        n_components=70,
        algorithm="randomized",
        n_iter=10,
        random_state=42
    )
    X_semantic = svd.fit_transform(X)

    if plot_LSA:
        plot_LSA(svd)
    else:
        explained = svd.explained_variance_ratio_
        cumulative = np.cumsum(explained)
        print("Cumulative explained variance: ", cumulative[-1])

    resume_vec = X_semantic[0:1]
    project_matrix = X_semantic[1:]

    # Cosine similarity of resume to each project
    similarities = cosine_similarity(resume_vec, project_matrix).ravel()

    # Sort by score descending, then take top_k
    indices = similarities.argsort()[::-1]
    top_indices = indices[:top_k]

    result = []
    for i in top_indices:
        score = float(similarities[i])
        item = dict(projects[i])
        item["score"] = round(score, 6)
        result.append(item)

    return result, indices

if __name__ == "__main__":
    sample_resume = "/Users/alyssachu/MIT/urop-search-engine/Relevance/Resume CS.pdf"
    sample_projects = "/Users/alyssachu/MIT/urop-search-engine/Relevance/sample_projects.json"

    with open(sample_projects) as f:
        projects = json.load(f)

    results, indices = find_most_relevant_LSA(sample_resume, projects, top_k=5)
    for r in results:
        print(r["score"], r["title"])
