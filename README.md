

## 🔍 Research Work (PhD)

**Title:** *An Intelligent Approach to Knowledge Graph Construction for Bharatiya Hindu Scriptures*

This research focuses on the construction and application of **knowledge graphs** for Bharatiya Hindu scriptures to enable **structured representation, semantic retrieval, and explainable question answering** over traditionally unstructured textual data.

---

## 🚀 Research Methodology

### 🔹 Phase 1: Literature Review and Domain Identification

A systematic literature review (SLR) was conducted using the **PRISMA methodology** to identify research gaps in knowledge graphs and question answering systems.

- Analysed multiple domains such as healthcare, education, and geoscience  
- Identified that **Hindu scriptures remain unexplored** in KG research  
- Established this as a **new research domain**

---

### 🔹 Phase 2: Knowledge Graph Construction (KG4HS)

A domain-specific knowledge graph (**KG4HS**) was developed using:

- Neo4j (Graph Database)  
- Cypher Query Language  

📊 **Graph Statistics:**
- Entities: **50**
- Relationships: **109**

This phase structured scriptural knowledge into **entities and semantic relationships**, forming the foundation of the system.

---

### 🔹 Phase 3: Knowledge Graph Question Answering (KGQA4HS)

A knowledge graph-based question answering system (**KGQA4HS**) was developed.

💡 Key Features:
- Converts natural language queries into **Cypher queries**  
- Retrieves answers using **graph traversal**  
- Provides **explainable answers via relationships**

📊 **Extended Knowledge Graph:**
- Entities: **364**
- Relationships: **790**

📚 **Domains Covered:**
- Vedas  
- Ramayana  
- Mahabharata  
- Bhagavad Gita  

📌 Example:
**Question:** Who taught Hanuman the art of speech?  
**Answer:** Surya  
**Explanation:** `Surya → TAUGHT → Hanuman`

---

### 🔹 Phase 4: Knowledge Graph Visualisation (KGViz4HS)

An interactive visualisation system (**KGViz4HS**) was developed to enhance interpretability.

🎯 Features:
- Tabular answer representation  
- Graph visualization of entities and relationships  
- Interactive node expansion  
- Entity search functionality  
- Response time display  

This supports **Explainable AI (XAI)** by showing reasoning behind answers.

---

## 🔄 System Workflow

Natural Language Query  
→ Flask Backend  
→ Query Mapping (Cypher)  
→ Neo4j Execution  
→ Subgraph Retrieval  
→ Tabular + Graph Output  

---

## 🛠️ Technology Stack

- **Backend:** Flask (Python)  
- **Database:** Neo4j  
- **Query Language:** Cypher  
- **Frontend:** HTML, CSS, JavaScript  
- **Visualization:** vis-network  

---

## 📁 Project Structure
KGQA4HS/
│── app.py
│── templates/
│ └── dashboard.html
│── static/
│ ├── css/style.css
│ ├── app.js
│ └── images/
│── data/
│ ├── ramayana_questions.json
│ ├── mahabharata_questions.json
│ ├── vedas_questions.json
│ └── bhagwadgita_questions.json


---

## ▶️ How to Run

```bash
git clone https://github.com/your-username/KGQA4HS.git
cd KGQA4HS
pip install flask neo4j
python app.py

Open in browser:

http://127.0.0.1:5000/
🌟 Key Contributions
First Knowledge Graph for Hindu Scriptures
Domain-specific KGQA system
Integration of Explainable AI
Interactive visualization for better understanding
🔮 Future Scope
Multi-hop reasoning
Larger knowledge graph expansion
Integration with Large Language Models (LLMs)
Deployment as a web application
👩‍💻 Author

Neena Mishra
PhD Scholar, Computer Science & Engineering
Maharishi University of Information Technology, Lucknow, India

📜 License

© 2026 Neena Mishra. All rights reserved.
This work is part of ongoing PhD research.
