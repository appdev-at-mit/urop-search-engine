from relavence_TFIDF import find_most_relevant
from relavence_TFIDF_LSA import find_most_relevant_LSA
from relavence_ST import rank_projects
from relavence_ST import _extract_text_from_pdf
from sentence_transformers import SentenceTransformer
import json

def rbo(rank_a, rank_b, p=0.9):
    """
    Compute Rank-Biased Overlap between two rankings.

    p controls top-weighting:
    0.9–0.98 typical.
    """
    depth = max(len(rank_a), len(rank_b))
    score = 0.0

    seen_a = set()
    seen_b = set()

    for d in range(1, depth + 1):
        if d <= len(rank_a):
            seen_a.add(rank_a[d-1])
        if d <= len(rank_b):
            seen_b.add(rank_b[d-1])

        overlap = len(seen_a.intersection(seen_b))
        score += overlap / d * (p ** (d - 1))

    return (1 - p) * score

if __name__ == "__main__":
    sample_resume = "/Users/alyssachu/MIT/urop-search-engine/Relevance/Resume CS.pdf"
    sample_projects = "/Users/alyssachu/MIT/urop-search-engine/Relevance/sample_projects.json"

    with open(sample_projects) as f:
        projects = json.load(f)

    chatgptBase = [5, 8, 56, 68, 19, 3, 34, 9, 99, 26, 17, 44, 1, 20, 76, 18, 4, 60, 38, 92, 2, 47, 36, 62, 6, 50, 14, 49, 39, 87, 100, 37, 82, 42, 84, 95, 54, 64, 28, 83, 88, 12, 33, 86, 81, 45, 24, 71, 51, 89, 31, 63, 13, 58, 79, 23, 65, 27, 53, 29, 90, 97, 69, 21, 78, 52, 66, 30, 57, 80, 41, 73, 96, 85, 91, 55, 67, 43, 70, 11, 59, 94, 16, 35, 22, 46, 25, 10, 75, 7, 15, 32, 40, 72, 98, 61, 74, 77, 93, 48]

    results_LSA, indices_LSA = find_most_relevant_LSA(sample_resume, projects, top_k=5)
    results, indices = find_most_relevant(sample_resume, projects, top_k=5)

    print(results[:5]) 
    print(results_LSA[:5])

    # resume_text = _extract_text_from_pdf(sample_resume)
    # model = SentenceTransformer("all-MiniLM-L6-v2")
    # scored = rank_projects(resume_text, projects, model)
    # indices_ST = [p[0] for p in scored]

    rbo_score = rbo(chatgptBase, indices, p=0.9)
    rbo_score_LSA = rbo(chatgptBase, indices_LSA, p=0.9)
    # rbo_score_ST = rbo(chatgptBase, indices_ST, p=0.9) 

    print("RBO score:", rbo_score)
    print("RBO score LSA:", rbo_score_LSA)
    # print("RBO score ST:", rbo_score_ST)