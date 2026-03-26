from flask import Flask, render_template, request, jsonify
from neo4j import GraphDatabase
import json
import os
import difflib
import time

app = Flask(__name__)

print("🔥 REAL APP WITH NEO4J RUNNING")

# -------------------------------
# Neo4j connection
# -------------------------------
driver = GraphDatabase.driver(
    "bolt://localhost:7687",
    auth=("neo4j", "avni16313")
)

# -------------------------------
# Paths
# -------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")

DOMAIN_FILES = {
    "ramayana": "ramayana_questions.json",
    "mahabharata": "mahabharata_questions.json",
    "vedas": "vedas_questions.json",
    "bhagwadgita": "bhagwadgita_questions.json",
}

# -------------------------------
# Load JSON
# -------------------------------
def load_domain(domain):
    filename = DOMAIN_FILES.get(domain)
    if not filename:
        return None

    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        print("❌ JSON not found:", path)
        return None

    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

# -------------------------------
# Best Match Function
# -------------------------------
def best_match(typed, questions):
    best = None
    best_score = 0

    for q in questions:
        score = difflib.SequenceMatcher(
            None,
            typed.lower(),
            q.get("question", "").lower()
        ).ratio()

        if score > best_score:
            best_score = score
            best = q

    return best, best_score

# -------------------------------
# Node label helper
# -------------------------------
def node_display_label(node, fallback=""):
    return str(
        node.get("name")
        or node.get("text")
        or node.get("value")
        or node.get("title")
        or node.get("entity")
        or fallback
        or "Node"
    )

# -------------------------------
# Add node to graph
# -------------------------------
def add_node(graph, node, fallback_domain=""):
    if node is None:
        return

    node_id = str(node.element_id)

    existing_ids = {n["id"] for n in graph["nodes"]}
    if node_id in existing_ids:
        return

    graph["nodes"].append({
        "id": node_id,
        "label": node_display_label(node, node_id),
        "domain": node.get("domain") or node.get("scripture") or fallback_domain
    })

# -------------------------------
# Add edge to graph
# -------------------------------
def add_edge(graph, rel):
    if rel is None:
        return

    edge = {
        "from": str(rel.start_node.element_id),
        "to": str(rel.end_node.element_id),
        "label": rel.type
    }

    if edge not in graph["edges"]:
        graph["edges"].append(edge)

# -------------------------------
# Convert Neo4j records -> graph
# Handles Path, Node, Relationship
# -------------------------------
def records_to_graph(records, fallback_domain=""):
    graph = {"nodes": [], "edges": []}

    for record in records:
        for value in record.values():

            # Path object
            if hasattr(value, "nodes") and hasattr(value, "relationships"):
                for node in value.nodes:
                    add_node(graph, node, fallback_domain)
                for rel in value.relationships:
                    add_edge(graph, rel)

            # Node object
            elif hasattr(value, "labels") and hasattr(value, "element_id"):
                add_node(graph, value, fallback_domain)

            # Relationship object
            elif hasattr(value, "start_node") and hasattr(value, "end_node") and hasattr(value, "type"):
                add_node(graph, value.start_node, fallback_domain)
                add_node(graph, value.end_node, fallback_domain)
                add_edge(graph, value)

    return graph

# -------------------------------
# Extract answers safely
# -------------------------------
def extract_answers(records):
    answers = []

    for record in records:
        # first try answer keys
        for key in record.keys():
            if key.lower() == "answer":
                value = record.get(key)

                if isinstance(value, list):
                    for v in value:
                        if v is not None and str(v).strip():
                            answers.append(str(v).strip())
                else:
                    if value is not None and str(value).strip():
                        answers.append(str(value).strip())

        # fallback primitive values
        if not answers:
            for value in record.values():
                if isinstance(value, (str, int, float)):
                    text = str(value).strip()
                    if text:
                        answers.append(text)

    unique_answers = []
    seen = set()
    for a in answers:
        if a not in seen:
            unique_answers.append(a)
            seen.add(a)

    return unique_answers

# -------------------------------
# Home route
# -------------------------------
@app.route("/")
def home():
    return render_template("dashboard.html", counts={
        "ramayana": 0,
        "mahabharata": 0,
        "vedas": 0,
        "bhagwadgita": 0
    })

# -------------------------------
# Main QA route
# -------------------------------
@app.route("/api/ask_text", methods=["POST"])
def ask_text():
    start_time = time.perf_counter()

    data = request.get_json(silent=True) or {}
    domain = data.get("domain", "ramayana").strip().lower()
    typed = data.get("question", "").strip()

    print("📌 QUESTION:", typed)

    dom = load_domain(domain)
    if not dom:
        end_time = time.perf_counter()
        return jsonify({
            "error": "Domain not found",
            "response_time_ms": round((end_time - start_time) * 1000, 2)
        }), 400

    best, score = best_match(typed, dom.get("questions", []))
    if not best:
        end_time = time.perf_counter()
        return jsonify({
            "error": "No matching question found",
            "response_time_ms": round((end_time - start_time) * 1000, 2)
        }), 400

    cypher = best.get("cypher", "")
    print("🔎 CYPHER:", cypher)

    try:
        with driver.session() as session:
            result = session.run(cypher)
            records = list(result)

        print("📊 RECORD COUNT:", len(records))

        answers = extract_answers(records)
        graph = records_to_graph(records, fallback_domain=domain)

        print("✅ ANSWERS:", answers)
        print("✅ GRAPH:", graph)

        end_time = time.perf_counter()
        response_time_ms = round((end_time - start_time) * 1000, 2)

        return jsonify({
            "matched": best.get("question"),
            "answers": answers,
            "graph": graph,
            "response_time_ms": response_time_ms
        })

    except Exception as e:
        print("❌ Neo4j ERROR:", e)
        end_time = time.perf_counter()
        return jsonify({
            "error": str(e),
            "response_time_ms": round((end_time - start_time) * 1000, 2)
        }), 500

# -------------------------------
# Search Entity
# returns connected entity graph
# -------------------------------
@app.route("/search_entity", methods=["POST"])
def search_entity():
    data = request.get_json(silent=True) or {}
    entity = (data.get("entity") or "").strip()

    if not entity:
        return jsonify({
            "found": False,
            "message": "Empty entity"
        })

    query = """
    MATCH (n)
    WHERE
        toLower(coalesce(n.name, '')) CONTAINS toLower($entity)
        OR toLower(coalesce(n.text, '')) CONTAINS toLower($entity)
        OR toLower(coalesce(n.value, '')) CONTAINS toLower($entity)
        OR toLower(coalesce(n.title, '')) CONTAINS toLower($entity)
        OR toLower(coalesce(n.entity, '')) CONTAINS toLower($entity)

    WITH n,
         coalesce(n.name, n.text, n.value, n.title, n.entity, '') AS node_name
    ORDER BY
        CASE
            WHEN toLower(node_name) = toLower($entity) THEN 0
            WHEN toLower(node_name) STARTS WITH toLower($entity) THEN 1
            ELSE 2
        END,
        size(node_name)

    LIMIT 1

    OPTIONAL MATCH (n)-[r]-(m)
    RETURN n, r, m
    LIMIT 50
    """

    try:
        with driver.session() as session:
            rows = list(session.run(query, entity=entity))

        if not rows:
            return jsonify({
                "found": False,
                "message": "No entity found"
            })

        main_node = rows[0]["n"]
        main_id = str(main_node.element_id)
        main_name = node_display_label(main_node, main_id)
        main_domain = main_node.get("domain") or main_node.get("scripture") or ""
        main_description = (
            main_node.get("description")
            or main_node.get("details")
            or main_node.get("info")
            or ""
        )

        labels = list(main_node.labels)
        main_type = labels[0] if labels else "Entity"

        graph = {"nodes": [], "edges": []}
        relations = []
        seen_rel_text = set()

        for row in rows:
            n = row["n"]
            r = row["r"]
            m = row["m"]

            add_node(graph, n, main_domain or "Unknown")
            add_node(graph, m, main_domain or "Unknown")

            if r is not None:
                add_edge(graph, r)

            if r is not None and m is not None:
                from_name = node_display_label(r.start_node, str(r.start_node.element_id))
                to_name = node_display_label(r.end_node, str(r.end_node.element_id))
                rel_label = r.type

                rel_key = (from_name, rel_label, to_name)
                if rel_key not in seen_rel_text:
                    relations.append({
                        "from": from_name,
                        "label": rel_label,
                        "to": to_name
                    })
                    seen_rel_text.add(rel_key)

        if not main_domain:
            connected_domains = []
            for row in rows:
                m = row["m"]
                if m is not None:
                    md = m.get("domain") or m.get("scripture")
                    if md:
                        connected_domains.append(md)

            main_domain = connected_domains[0] if connected_domains else "Unknown"

        if not main_description:
            if relations:
                main_description = f"{main_name} is connected to {len(relations)} relation(s) in the knowledge graph."
            else:
                main_description = "No description available"

        # update first/main node domain if needed
        for n in graph["nodes"]:
            if n["id"] == main_id:
                n["domain"] = main_domain

        return jsonify({
            "found": True,
            "node_element_id": main_id,
            "name": main_name,
            "type": main_type,
            "domain": main_domain,
            "description": main_description,
            "relations": relations[:10],
            "graph": graph
        })

    except Exception as e:
        print("❌ ENTITY SEARCH ERROR:", e)
        return jsonify({
            "found": False,
            "message": str(e)
        }), 500

# -------------------------------
# Expand clicked node
# -------------------------------
@app.route("/expand_node", methods=["POST"])
def expand_node():
    data = request.get_json(silent=True) or {}
    node_element_id = (data.get("node_element_id") or "").strip()

    if not node_element_id:
        return jsonify({
            "nodes": [],
            "edges": []
        })

    query = """
    MATCH (n)-[r]-(m)
    WHERE elementId(n) = $node_element_id
    RETURN
        n, r, m
    LIMIT 10
    """

    try:
        with driver.session() as session:
            rows = list(session.run(query, node_element_id=node_element_id))

        graph = {"nodes": [], "edges": []}

        for row in rows:
            add_node(graph, row["n"], "")
            add_node(graph, row["m"], "")
            add_edge(graph, row["r"])

        return jsonify({
            "nodes": graph["nodes"],
            "edges": graph["edges"]
        })

    except Exception as e:
        print("❌ EXPAND NODE ERROR:", e)
        return jsonify({
            "nodes": [],
            "edges": [],
            "error": str(e)
        }), 500

# -------------------------------
# Debug route
# -------------------------------
@app.route("/debug_nodes")
def debug_nodes():
    query = """
    MATCH (n)
    RETURN labels(n) AS labels, keys(n) AS keys, elementId(n) AS eid, n
    LIMIT 10
    """

    try:
        rows = []
        with driver.session() as session:
            result = session.run(query)
            for r in result:
                rows.append({
                    "labels": r["labels"],
                    "keys": r["keys"],
                    "element_id": r["eid"],
                    "node": dict(r["n"])
                })

        return jsonify(rows)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -------------------------------
# Run app
# -------------------------------
if __name__ == "__main__":
    app.run(debug=True)