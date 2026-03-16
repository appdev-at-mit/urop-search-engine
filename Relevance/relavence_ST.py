import re
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import json
from pathlib import Path
import pdfplumber

def top_matches(sim, resume_sents, project_sents, top_n=5):
    pairs = []
    for i in range(sim.shape[0]):
        for j in range(sim.shape[1]):
            pairs.append((sim[i, j], resume_sents[i], project_sents[j]))
    pairs.sort(reverse=True, key=lambda x: x[0])
    return pairs[:top_n]

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

def split_sentences(text: str):
    # simple splitter; for resumes, bullet splitting often helps too
    parts = re.split(r'[\n•]+|(?<=[.!?])\s+', text)
    return [p.strip() for p in parts if p.strip()]


def embed_sentences(model, sentences):
    return model.encode(sentences, normalize_embeddings=True)


def sentence_relevance_score(
    resume_text: str,
    project_title: str,
    project_description: str,
    project_requirements: str,
    model,
    alpha: float = 0.3,
    print_matches: bool = False
):
    # 1) split into sentences/chunks
    resume_sents = split_sentences(resume_text)

    project_sents = (
        [project_title.strip()] +
        split_sentences(project_description) +
        split_sentences(project_requirements)
    )

    # 2) weights
    project_weights = [1.5]  # title
    project_weights += [1.0] * len(split_sentences(project_description))
    project_weights += [2.0] * len(split_sentences(project_requirements))
    project_weights = np.array(project_weights, dtype=float)

    resume_weights = np.ones(len(resume_sents), dtype=float)

    # 3) embeddings
    resume_emb = embed_sentences(model, resume_sents)
    project_emb = embed_sentences(model, project_sents)

    # 4) pairwise similarity matrix
    sim = cosine_similarity(resume_emb, project_emb)  # shape: [m, n]

    if print_matches:
        for score, r, p in top_matches(sim, resume_sents, project_sents):
            print(f"{score:.3f}")
            print("RESUME:", r)
            print("PROJECT:", p)
            print()

    # 5) aggregate
    # each resume sentence finds its best project match
    r_to_p = sim.max(axis=1)
    score_r_to_p = np.average(r_to_p, weights=resume_weights)

    # each project sentence finds its best resume match
    p_to_r = sim.max(axis=0)
    score_p_to_r = np.average(p_to_r, weights=project_weights)

    final_score = alpha * score_r_to_p + (1 - alpha) * score_p_to_r

    return {
        "final_score": float(final_score),
        "score_resume_to_project": float(score_r_to_p),
        "score_project_to_resume": float(score_p_to_r),
        "similarity_matrix": sim,
        "resume_sentences": resume_sents,
        "project_sentences": project_sents,
    }

def rank_projects(resume_text, projects, model):
    scored = []

    for p in projects:
        result = sentence_relevance_score(
            resume_text,
            p["title"],
            p["description"],
            p["requirements"],
            model
        )
        scored.append((p["id"], result["final_score"]))

    scored.sort(key=lambda x: x[1], reverse=True)
    return scored

if __name__ == "__main__":
    model = SentenceTransformer("all-MiniLM-L6-v2")

    sample_resume = "/Users/alyssachu/MIT/urop-search-engine/Relevance/Resume CS.pdf"
    sample_projects = "/Users/alyssachu/MIT/urop-search-engine/Relevance/sample_projects.json"

    resume_text = _extract_text_from_pdf(sample_resume)
    print(resume_text)

    with open(sample_projects) as f:
        projects = json.load(f)

    scored = rank_projects(resume_text, projects, model)
    print(scored)