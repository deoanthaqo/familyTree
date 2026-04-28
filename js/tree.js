// ============================================
// FAMILY TREE VISUALIZATION WITH D3.js
// ============================================

let familyData = [];
let currentPerson = null;
let spousePerson = null;
let zoomBehavior;
let svg, g;

// Generation colors mapping
const generationColors = {
  G0: "#e74c3c",
  G1: "#f39c12",
  G2: "#27ae60",
  G3: "#3498db",
};

// Initialize on page load
document.addEventListener("DOMContentLoaded", async function () {
  try {
    const response = await fetch("./js/data.json");
    const data = await response.json();
    familyData = data.family;

    // Build hierarchy and render tree
    const root = buildHierarchy(familyData);
    renderTree(root);
  } catch (error) {
    console.error("Error loading family data:", error);
  }
});

// ============================================
// HIERARCHY BUILDER
// ============================================

function buildHierarchy(flatData) {
  const nodeMap = {};

  // 1. Filter hanya anggota jalur darah (bloodline) sebagai node utama
  const primaryMembers = flatData.filter((person) => {
    return (
      (person.parents_id && person.parents_id.length > 0) ||
      person.id === "G0-1"
    );
  });

  // 2. Petakan data dan kumpulkan semua pasangan ke dalam array spouses_data
  primaryMembers.forEach((person) => {
    const marriages = person.marriage_info
      ? Array.isArray(person.marriage_info)
        ? person.marriage_info
        : [person.marriage_info]
      : [];

    nodeMap[person.id] = {
      ...person,
      children: [],
      spouses_data: marriages
        .map((m) => flatData.find((p) => p.id === m.spouse_id))
        .filter(Boolean),
    };
  });

  // 3. Bangun struktur hierarki
  const roots = [];
  primaryMembers.forEach((person) => {
    const node = nodeMap[person.id];
    const parentId = person.parents_id.find((pid) => nodeMap[pid]);

    if (parentId) {
      nodeMap[parentId].children.push(node);
    } else {
      if (node.id === "G0-1") roots.push(node);
    }
  });

  return roots[0]; // G0-1 sekarang menjadi Root tunggal di puncak
}

// ============================================
// TREE RENDERING
// ============================================

function renderTree(rootData) {
  const container = document.querySelector(".tree-container");
  let width = container.clientWidth;
  let height = container.clientHeight;
  // Fallback jika height 0 (misal: layout belum siap)
  if (!height || height < 200) height = 600;

  // Clear existing SVG
  d3.select("#tree-svg").selectAll("*").remove();

  svg = d3.select("#tree-svg").attr("width", width).attr("height", height);

  // Create a group for the tree
  g = svg.append("g");

  // Setup zoom behavior
  zoomBehavior = d3
    .zoom()
    .scaleExtent([0.3, 3])
    .on("zoom", (event) => {
      g.attr("transform", event.transform);
    });

  svg.call(zoomBehavior);

  // Create tree layout (HORIZONTAL: x = level/generasi, y = horizontal spread)
  const treeLayout = d3
    .tree()
    .nodeSize([320, 300]) // Lebar horizontal 320px (lebih lebar sedikit dari kartu pasangan 280px)
    .separation((a, b) => {
      // Ganti optional chaining dengan logika yang lebih kompatibel
      const aSpouses =
        a.data && a.data.spouses_data ? a.data.spouses_data.length : 0;
      const bSpouses =
        b.data && b.data.spouses_data ? b.data.spouses_data.length : 0;
      const aWidth = (aSpouses + 1) * 140;
      const bWidth = (bSpouses + 1) * 140;
      const minSpace = (aWidth + bWidth) / 2 + 20;
      return Math.max(minSpace / 320, a.parent === b.parent ? 1.1 : 1.3);
    });

  const root = d3.hierarchy(rootData);
  treeLayout(root);

  // Center the tree (horizontal)
  const initialTransform = d3.zoomIdentity.translate(width / 2, 80).scale(0.7); // Skala ditingkatkan kembali ke 0.7 agar lebih jelas
  svg.call(zoomBehavior.transform, initialTransform);

  // Draw links (HORIZONTAL: x = level, y = horizontal spread)
  const links = g
    .selectAll(".link")
    .data(root.links())
    .enter()
    .append("path")
    .attr("class", "link")
    .attr(
      "d",
      d3
        .linkVertical()
        .x((d) => d.x)
        .y((d) => d.y),
    );

  // Draw nodes (HORIZONTAL: x = level, y = horizontal spread)
  const nodes = g
    .selectAll(".node")
    .data(root.descendants())
    .enter()
    .append("g")
    .attr("class", "node")
    .attr("transform", (d) => `translate(${d.x}, ${d.y})`)
    .on("click", (event, d) => {
      event.stopPropagation();
      if (!d.data.isVirtual) {
        showModal(d.data);
      }
    });

  // Skip rendering for virtual root
  nodes.each(function (d) {
    if (d.data.isVirtual) {
      d3.select(this).style("display", "none");
      return;
    }

    const nodeGroup = d3.select(this);
    const generation = d.data.id.split("-")[0];
    const spouses = d.data.spouses_data || [];
    const cardWidth = (1 + spouses.length) * 140;
    const xOffset = -(cardWidth / 2);

    // Node card background
    nodeGroup
      .append("rect")
      .attr("class", "node-rect")
      .attr("x", xOffset)
      .attr("y", 0)
      .attr("width", cardWidth)
      .attr("height", 160)
      .attr("rx", 10);

    // Fungsi pembantu untuk menggambar profil orang
    const drawPerson = (person, xPos) => {
      // Lingkaran foto
      nodeGroup
        .append("circle")
        .attr("class", "node-photo-circle")
        .attr("cx", xPos)
        .attr("cy", 45)
        .attr("r", 38);

      const clipId = `clip-${person.id}`;
      svg
        .append("defs")
        .append("clipPath")
        .attr("id", clipId)
        .append("circle")
        .attr("cx", xPos)
        .attr("cy", 45)
        .attr("r", 35);

      // Tambahkan timestamp (?t=...) untuk menghindari browser caching
      const timestamp = new Date().getTime();
      let photoUrl =
        person.photo_url &&
        typeof person.photo_url === "string" &&
        person.photo_url.trim() !== ""
          ? `${person.photo_url}?t=${timestamp}`
          : "./images/placeholder.png";

      nodeGroup
        .append("image")
        .attr("class", "node-photo")
        .attr("x", xPos - 35)
        .attr("y", 10)
        .attr("width", 70)
        .attr("height", 70)
        .attr("clip-path", `url(#${clipId})`)
        .attr("href", photoUrl)
        .on("error", function () {
          d3.select(this).attr("href", "./images/placeholder.png");
        });

      // Nama
      nodeGroup
        .append("text")
        .attr("class", "node-name")
        .attr("x", xPos)
        .attr("y", 120)
        .text(truncateText(person.name, 14));

      // Ikon Gender
      const genderColor = person.gender === "Laki-laki" ? "#3498db" : "#e91e63";
      nodeGroup
        .append("circle")
        .attr("cx", xPos)
        .attr("cy", 145)
        .attr("r", 8)
        .attr("fill", genderColor)
        .attr("opacity", 0.2);

      nodeGroup
        .append("text")
        .attr("x", xPos)
        .attr("y", 149)
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .attr("fill", genderColor)
        .text(person.gender === "Laki-laki" ? "♂" : "♀");

      // Hit area untuk modal
      nodeGroup
        .append("rect")
        .attr("x", xPos - 60)
        .attr("y", 5)
        .attr("width", 120)
        .attr("height", 150)
        .attr("fill", "transparent")
        .on("click", (event) => {
          event.stopPropagation();
          showModal(person);
        });
    };

    if (spouses.length === 2) {
      // Layout 3 orang: Suami 1 - Ritta - Suami 2
      drawPerson(spouses[0], xOffset + 70); // Muklas
      drawPerson(d.data, xOffset + 210); // Ritta
      drawPerson(spouses[1], xOffset + 350); // Sadjali
    } else if (spouses.length === 1) {
      drawPerson(d.data, xOffset + 70);
      drawPerson(spouses[0], xOffset + 210);
    } else {
      drawPerson(d.data, 0);
    }

    // Generation badge
    nodeGroup
      .append("rect")
      .attr("class", "generation-badge")
      .attr("x", -20)
      .attr("y", 88)
      .attr("width", 40)
      .attr("height", 18)
      .attr("rx", 9)
      .attr("fill", generationColors[generation] || "#95a5a6");
    nodeGroup
      .append("text")
      .attr("class", "node-generation")
      .attr("x", 0)
      .attr("y", 101)
      .text(generation);
  });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function truncateText(text, maxLength) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

function formatDate(dateString) {
  if (!dateString) return "-";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const options = { day: "numeric", month: "long", year: "numeric" };
  return date.toLocaleDateString("id-ID", options);
}

// ============================================
// ZOOM CONTROLS
// ============================================

function zoomIn() {
  svg.transition().duration(300).call(zoomBehavior.scaleBy, 1.3);
}

function zoomOut() {
  svg.transition().duration(300).call(zoomBehavior.scaleBy, 0.7);
}

function resetZoom() {
  const container = document.querySelector(".tree-container");
  const width = container.clientWidth;

  svg
    .transition()
    .duration(500)
    .call(
      zoomBehavior.transform,
      d3.zoomIdentity.translate(width / 2, 80).scale(0.8),
    );
}

// ============================================
// MODAL FUNCTIONS
// ============================================

function showModal(person) {
  currentPerson = person;
  spousePerson = null;

  const modal = document.getElementById("detailModal");

  // Set photo with error handling
  const modalPhoto = document.getElementById("modalPhoto");
  // Tambahkan timestamp untuk menghindari browser caching pada modal
  const timestamp = new Date().getTime();
  const photoUrl =
    person.photo_url && person.photo_url.trim() !== ""
      ? `${person.photo_url}?t=${timestamp}`
      : "./images/placeholder.png";
  modalPhoto.src = photoUrl;
  modalPhoto.onerror = function () {
    this.src = "./images/placeholder.png";
  };

  // Helper function to handle field visibility
  const setField = (id, value, containerId) => {
    const element = document.getElementById(id);
    const container = document.getElementById(containerId);

    if (value && value.toString().trim() !== "" && value !== "-") {
      element.textContent = value;
      container.style.display = "block";
    } else {
      container.style.display = "none";
    }
  };

  // Set basic info
  document.getElementById("modalName").textContent = person.name;
  const gen = person.id.split("-")[0];
  const modalGen = document.getElementById("modalGeneration");

  // Tentukan apakah Bloodline atau Spouse
  const isBloodline =
    (person.parents_id && person.parents_id.length > 0) || person.id === "G0-1";
  let typeInfo = isBloodline ? "Bloodline" : "Spouse";

  // Jika Bloodline dan memiliki orang tua, ambil nama mereka
  if (isBloodline && person.parents_id && person.parents_id.length > 0) {
    const parentNames = person.parents_id
      .map((pid) => familyData.find((p) => p.id === pid)?.name)
      .filter(Boolean);
    if (parentNames.length > 0) {
      typeInfo += ` (Anak dari ${parentNames.join(" & ")})`;
    }
  }

  modalGen.textContent = `${gen} - ${typeInfo}`;
  modalGen.style.backgroundColor = generationColors[gen] || "#95a5a6";

  setField("modalGender", person.gender, "itemGender");
  setField("modalPob", person.pob, "itemPob");
  setField("modalDob", person.dob ? formatDate(person.dob) : null, "itemDob");
  setField("modalDod", person.dod ? formatDate(person.dod) : null, "itemDod");
  setField("modalBurial", person.burial_place, "itemBurial");
  setField("modalProfession", person.profession, "itemProfession");
  setField("modalEducation", person.education, "itemEducation");
  setField("modalBio", person.bio, "itemBio");

  // Marriage info
  const marriageSection = document.getElementById("marriageSection");
  const modalActions = document.querySelector(".modal-actions");

  // Bersihkan tombol yang ada sebelumnya
  modalActions.innerHTML = "";

  const marriages = person.marriage_info
    ? Array.isArray(person.marriage_info)
      ? person.marriage_info
      : [person.marriage_info]
    : [];
  if (marriages.length > 0) {
    marriageSection.style.display = "block";
    const marriageTexts = marriages.map(
      (m) =>
        `${m.spouse_name}${m.marriage_date ? " (" + m.marriage_date + ")" : ""}`,
    );
    document.getElementById("modalMarriage").textContent =
      `Pasangan: ${marriageTexts.join(", ")}`;

    // Buat tombol dinamis untuk setiap pasangan
    marriages.forEach((m) => {
      const spouse = familyData.find((p) => p.id === m.spouse_id);
      if (spouse) {
        const btn = document.createElement("button");
        btn.className = "btn-spouse";

        // Beri label spesifik jika ada info pernikahan (misal: Suami Pertama)
        const label = m.marriage_date ? ` (${m.marriage_date})` : "";
        btn.textContent = `Lihat Profil ${m.spouse_name}${label}`;

        btn.onclick = () => showModal(spouse);
        modalActions.appendChild(btn);
      }
    });
  } else {
    marriageSection.style.display = "none";
  }

  // Show modal
  modal.classList.add("active");
}

function closeModal() {
  const modal = document.getElementById("detailModal");
  modal.classList.remove("active");
  currentPerson = null;
  spousePerson = null;
}

// Close modal when clicking outside
document.addEventListener("click", function (event) {
  const modal = document.getElementById("detailModal");
  if (event.target === modal) {
    closeModal();
  }
});
