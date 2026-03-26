console.log("FINAL APP.JS LOADED");

let network = null;
let nodesDS = null;
let edgesDS = null;

function escapeHtml(str){
  return String(str ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function getNodeColorByDomain(domain){
  const d = String(domain || "").toLowerCase();

  if(d.includes("ramayana")) return { background: "#f4c542", border: "#b38710" };
  if(d.includes("mahabharata")) return { background: "#8ecae6", border: "#2878a0" };
  if(d.includes("vedas")) return { background: "#90be6d", border: "#4f772d" };
  if(d.includes("gita")) return { background: "#c77dff", border: "#7b2cbf" };

  return { background: "#d8b16a", border: "#9c6b22" };
}

function makeNode(n, fallbackDomain="", isFocus=false){
  const clr = getNodeColorByDomain(n.domain || fallbackDomain);

  return {
    id: String(n.id),
    label: n.label || String(n.id),
    domain: n.domain || fallbackDomain,
    shape: "dot",
    size: isFocus ? 28 : 18,
    color: clr,
    borderWidth: isFocus ? 4 : 2,
    font: {
      color: "#2b1d0e",
      size: isFocus ? 18 : 14,
      face: "Georgia"
    }
  };
}

function renderKeyValueTable(domain, question, answers){
  const wrap = document.getElementById("tableWrap");
  const table = document.getElementById("answerTable");
  if(!wrap || !table) return;

  wrap.style.display = "block";

  const ansText = (answers && answers.length) ? answers.join(", ") : "—";

  table.innerHTML = `
    <thead>
      <tr><th>Field</th><th>Value</th></tr>
    </thead>
    <tbody>
      <tr><td>Domain</td><td>${escapeHtml(domain)}</td></tr>
      <tr><td>Question</td><td>${escapeHtml(question)}</td></tr>
      <tr><td>Answer</td><td>${escapeHtml(ansText)}</td></tr>
      <tr><td>#Answers</td><td>${answers.length}</td></tr>
    </tbody>
  `;
}

function setResponseTime(ms){
  const timeLine = document.getElementById("timeLine");
  const perfBadge = document.getElementById("perfBadge");

  if(timeLine){
    timeLine.textContent = "Response Time: " + (ms ?? "—") + " ms";
  }
  if(perfBadge){
    perfBadge.textContent = "⚡ Response Time: " + (ms ?? "—") + " ms";
  }
}

function drawEmptyGraph(){
  const canvas = document.getElementById("graphCanvas");
  if(!canvas) return;

  if(network){
    network.destroy();
    network = null;
  }

  nodesDS = null;
  edgesDS = null;

  canvas.style.display = "flex";
  canvas.style.alignItems = "center";
  canvas.style.justifyContent = "center";
  canvas.innerHTML = "<div style='opacity:.85;'>—</div>";
}

function fitGraph(){
  if(network){
    network.fit({
      animation: {
        duration: 500,
        easingFunction: "easeInOutQuad"
      }
    });
  }
}

function downloadGraphPNG(){
  if(!network){
    alert("Graph is not available.");
    return;
  }

  fitGraph();

  setTimeout(() => {
    const canvas = document.querySelector("#graphCanvas canvas");
    if(!canvas){
      alert("Could not find graph canvas.");
      return;
    }

    const link = document.createElement("a");
    link.download = "kgqa4hs_graph.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }, 700);
}

function highlightNode(clickedNodeId){
  if(!nodesDS) return;

  nodesDS.forEach(node => {
    nodesDS.update({
      id: node.id,
      size: 18,
      borderWidth: 2,
      font: { color: "#2b1d0e", size: 14, face: "Georgia" }
    });
  });

  nodesDS.update({
    id: clickedNodeId,
    size: 30,
    borderWidth: 5,
    font: { color: "#2b1d0e", size: 18, face: "Georgia" }
  });

  if(network){
    network.focus(clickedNodeId, {
      scale: 1.15,
      animation: {
        duration: 500,
        easingFunction: "easeInOutQuad"
      }
    });
  }
}

async function expandClickedNode(clickedNodeId, fallbackDomain=""){
  if(!nodesDS || !edgesDS) return;

  try{
    const res = await fetch("/expand_node", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ node_element_id: String(clickedNodeId) })
    });

    const out = await res.json();

    if(!res.ok){
      console.log("Expand node error:", out);
      return;
    }

    let addedSomething = false;

    if(Array.isArray(out.nodes)){
      out.nodes.forEach(n => {
        const nid = String(n.id);
        if(!nodesDS.get(nid)){
          nodesDS.add(makeNode(n, fallbackDomain, false));
          addedSomething = true;
        }
      });
    }

    if(Array.isArray(out.edges)){
      out.edges.forEach(e => {
        const edgeId = `${e.from}_${e.label}_${e.to}`;
        if(!edgesDS.get(edgeId)){
          edgesDS.add({
            id: edgeId,
            from: String(e.from),
            to: String(e.to),
            label: e.label || "",
            arrows: {
              to: { enabled: true, scaleFactor: 0.7 }
            },
            width: 2,
            color: { color: "#5a4630" },
            font: {
              color: "#4a3725",
              size: 11,
              strokeWidth: 0
            },
            smooth: {
              enabled: true,
              type: "continuous"
            }
          });
          addedSomething = true;
        }
      });
    }

    if(network){
      network.redraw();

      if(addedSomething){
        network.stabilize(80);
      }

      network.focus(clickedNodeId, {
        scale: 1.15,
        animation: {
          duration: 500,
          easingFunction: "easeInOutQuad"
        }
      });
    }

  }catch(err){
    console.log("Expand node fetch error:", err);
  }
}

function drawGraph(graph, fallbackDomain = ""){
  const canvas = document.getElementById("graphCanvas");
  if(!canvas) return;

  if(network){
    network.destroy();
    network = null;
  }

  nodesDS = null;
  edgesDS = null;
  canvas.innerHTML = "";

  if(!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0){
    drawEmptyGraph();
    return;
  }

  canvas.style.display = "block";

  nodesDS = new vis.DataSet(
    graph.nodes.map((n, index) => makeNode(n, fallbackDomain, index === 0))
  );

  edgesDS = new vis.DataSet(
    (graph.edges || []).map(e => ({
      id: `${e.from}_${e.label}_${e.to}`,
      from: String(e.from),
      to: String(e.to),
      label: e.label || "",
      arrows: {
        to: { enabled: true, scaleFactor: 0.7 }
      },
      width: 2,
      color: { color: "#5a4630" },
      font: {
        color: "#4a3725",
        size: 11,
        strokeWidth: 0
      },
      smooth: {
        enabled: true,
        type: "continuous"
      }
    }))
  );

  const data = {
    nodes: nodesDS,
    edges: edgesDS
  };

  const options = {
    nodes: {
      shape: "dot",
      scaling: {
        min: 16,
        max: 30
      }
    },
    edges: {
      smooth: {
        enabled: true,
        type: "continuous"
      }
    },
    physics: {
      enabled: true,
      stabilization: {
        enabled: true,
        iterations: 200
      },
      barnesHut: {
        gravitationalConstant: -1800,
        centralGravity: 0.18,
        springLength: 170,
        springConstant: 0.03,
        damping: 0.18,
        avoidOverlap: 0.7
      }
    },
    interaction: {
      hover: true,
      dragNodes: true,
      dragView: true,
      zoomView: true
    },
    layout: {
      improvedLayout: true
    }
  };

  network = new vis.Network(canvas, data, options);

  network.once("stabilizationIterationsDone", function () {
    fitGraph();
  });

  network.on("click", async function(params){
    if(!params.nodes || params.nodes.length === 0) return;

    const clickedNodeId = String(params.nodes[0]);
    const clickedNode = nodesDS.get(clickedNodeId);

    if(!clickedNode) return;

    highlightNode(clickedNodeId);
    await expandClickedNode(clickedNodeId, fallbackDomain);
  });
}

function normalizeAnswers(out){
  if(Array.isArray(out?.answers)){
    return out.answers.map(x => String(x).trim()).filter(Boolean);
  }

  if(typeof out?.answers === "string" && out.answers.trim()){
    return [out.answers.trim()];
  }

  return [];
}

function setMatchedLine(out, typed){
  const matchLine = document.getElementById("matchLine");
  const qLine = document.getElementById("qLine");

  if(!matchLine || !qLine) return;

  if(typeof out?.matched === "string"){
    matchLine.textContent = "Matched: " + out.matched;
    qLine.textContent = out.matched || typed;
    return;
  }

  matchLine.textContent = "Matched: —";
  qLine.textContent = typed;
}

async function askTyped(){
  const domain = document.getElementById("domainSelectTop")?.value || "ramayana";
  const typed = (document.getElementById("typedQ")?.value || "").trim();

  if(!typed){
    alert("Please type a question.");
    return;
  }

  document.getElementById("matchLine").textContent = "Matched: ...";
  document.getElementById("qLine").textContent = typed;
  document.getElementById("ansLine").textContent = "Loading...";
  setResponseTime("...");

  renderKeyValueTable(domain, typed, []);

  const graphCanvas = document.getElementById("graphCanvas");
  if(graphCanvas){
    graphCanvas.innerHTML = "<div style='padding:12px;opacity:.9;'>Loading subgraph...</div>";
  }

  try{
    const res = await fetch("/api/ask_text", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ domain, question: typed })
    });

    const out = await res.json();

    if(!res.ok){
      const msg = out?.error || out?.details || ("HTTP " + res.status);
      document.getElementById("matchLine").textContent = "Matched: —";
      document.getElementById("qLine").textContent = typed;
      document.getElementById("ansLine").textContent = "Error: " + msg;
      setResponseTime(out?.response_time_ms ?? "—");
      renderKeyValueTable(domain, typed, []);
      drawEmptyGraph();
      return;
    }

    setMatchedLine(out, typed);

    const shownQuestion =
      (typeof out?.matched === "string")
        ? out.matched
        : typed;

    const answers = normalizeAnswers(out);

    document.getElementById("ansLine").textContent =
      answers.length ? answers.join(", ") : "—";

    renderKeyValueTable(domain, shownQuestion, answers);
    setResponseTime(out?.response_time_ms ?? "—");
    drawGraph(out.graph, domain);

    setTimeout(() => {
      if(document.body.classList.contains("screenshot-mode") && network){
        fitGraph();
      }
    }, 300);

  }catch(e){
    console.log("JS ERROR:", e);
    document.getElementById("matchLine").textContent = "Matched: —";
    document.getElementById("qLine").textContent = typed;
    document.getElementById("ansLine").textContent = "—";
    setResponseTime("—");
    renderKeyValueTable(domain, typed, []);
    drawEmptyGraph();
  }
}

function resetGraphView(){
  const typed = (document.getElementById("typedQ")?.value || "").trim();

  if(typed){
    askTyped();
  } else {
    location.reload();
  }
}

function quickEntity(name){
  const input = document.getElementById("entityInput");
  if(input){
    input.value = name;
  }
  searchEntity();
}

async function searchEntity(){
  const input = document.getElementById("entityInput");
  const resultBox = document.getElementById("entityResult");

  if(!input || !resultBox) return;

  const entity = (input.value || "").trim();

  if(!entity){
    resultBox.innerHTML = "Please enter an entity name.";
    return;
  }

  resultBox.innerHTML = "Searching...";

  try{
    const res = await fetch("/search_entity", {
      method: "POST",
      headers: {"Content-Type":"application/json"},
      body: JSON.stringify({ entity })
    });

    const out = await res.json();

    if(!res.ok || !out.found){
      resultBox.innerHTML = escapeHtml(out?.message || "No entity found.");
      drawEmptyGraph();
      return;
    }

    let html = `
      <h3>${escapeHtml(out.name || "—")}</h3>
      <p><strong>Type:</strong> ${escapeHtml(out.type || "Entity")}</p>
      <p><strong>Domain:</strong> ${escapeHtml(out.domain || "Unknown")}</p>
      <p><strong>Description:</strong> ${escapeHtml(out.description || "No description available")}</p>
    `;

    if(Array.isArray(out.relations) && out.relations.length > 0){
      html += `<p><strong>Relations:</strong></p><ul>`;
      out.relations.forEach(r => {
        html += `<li>${escapeHtml(r.from)} — ${escapeHtml(r.label)} → ${escapeHtml(r.to)}</li>`;
      });
      html += `</ul>`;
    }

    resultBox.innerHTML = html;

    if(out.graph && Array.isArray(out.graph.nodes) && out.graph.nodes.length > 0){
      drawGraph(out.graph, out.domain || "");
      setTimeout(() => {
        if(network) fitGraph();
      }, 250);
    } else {
      drawEmptyGraph();
    }

  }catch(err){
    console.log("Entity search error:", err);
    resultBox.innerHTML = "Error while searching entity.";
    drawEmptyGraph();
  }
}

function toggleAbout(){
  const aboutSection = document.getElementById("aboutSection");
  if(!aboutSection) return;

  if(aboutSection.style.display === "none" || aboutSection.style.display === ""){
    aboutSection.style.display = "block";
    aboutSection.scrollIntoView({ behavior: "smooth" });
  } else {
    aboutSection.style.display = "none";
  }
}

function toggleScreenshotMode(){
  document.body.classList.toggle("screenshot-mode");

  const snapBtn = document.getElementById("snapBtn");
  if(snapBtn){
    snapBtn.textContent = document.body.classList.contains("screenshot-mode")
      ? "Exit Screenshot Mode"
      : "Screenshot Mode";
  }

  setTimeout(() => {
    if(network){
      network.fit({
        animation: true,
        padding: 40
      });
    }
  }, 350);
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("askTopBtn")?.addEventListener("click", askTyped);

  document.getElementById("typedQ")?.addEventListener("keydown", (e) => {
    if(e.key === "Enter") askTyped();
  });

  document.getElementById("resetBtn")?.addEventListener("click", resetGraphView);
  document.getElementById("fitBtn")?.addEventListener("click", fitGraph);
  document.getElementById("downloadGraphBtn")?.addEventListener("click", downloadGraphPNG);
  document.getElementById("snapBtn")?.addEventListener("click", toggleScreenshotMode);

  document.getElementById("entitySearchBtn")?.addEventListener("click", searchEntity);

  document.getElementById("entityInput")?.addEventListener("keydown", (e) => {
    if(e.key === "Enter") searchEntity();
  });

  document.getElementById("aboutToggleBtn")?.addEventListener("click", toggleAbout);
});