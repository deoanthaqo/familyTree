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

  // 1. Filter hanya "Anggota Utama" (Bloodline)
  // Menantu tidak dijadikan node sendiri agar tidak muncul sebagai 'saudara' pasangan mereka.
  const primaryMembers = flatData.filter((person) => {
    // Jika punya orang tua, dia adalah anak (bloodline)
    if (person.parents_id && person.parents_id.length > 0) return true;

    // Jika tidak punya orang tua, cek apakah dia Root G0.
    // Kita pilih satu orang (G0-1) sebagai anchor agar Root hanya ada satu.
    if (person.marriage_info && person.marriage_info.spouse_id) {
      const spouse = flatData.find(
        (p) => p.id === person.marriage_info.spouse_id,
      );
      // Jika pasangan punya orang tua, maka person ini adalah menantu (bukan bloodline)
      if (spouse && spouse.parents_id && spouse.parents_id.length > 0)
        return false;
      // Jika keduanya tidak punya orang tua (G0), pilih laki-laki sebagai anchor utama
      if (spouse && person.gender === "Perempuan") return false;
    }
    return true;
  });

  // 2. Map anggota utama dan tempelkan data pasangan
  primaryMembers.forEach((person) => {
    nodeMap[person.id] = { ...person, children: [] };
    if (person.marriage_info && person.marriage_info.spouse_id) {
      nodeMap[person.id].spouse_data = flatData.find(
        (p) => p.id === person.marriage_info.spouse_id,
      );
    }
  });

  // 3. Bangun Hierarki
  const roots = [];
  primaryMembers.forEach((person) => {
    const node = nodeMap[person.id];
    const parentId = person.parents_id.find((pid) => nodeMap[pid]);

    if (parentId) {
      nodeMap[parentId].children.push(node);
    } else {
      roots.push(node);
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
    .nodeSize([200, 320]) // Beri ruang horizontal lebih luas untuk pasangan
    .separation((a, b) => (a.parent === b.parent ? 1.2 : 1.5));

  const root = d3.hierarchy(rootData);
  treeLayout(root);

  // Center the tree (horizontal)
  const initialTransform = d3.zoomIdentity.translate(width / 2, 80).scale(0.8);
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
    const hasSpouse = d.data.spouse_data;
    const cardWidth = hasSpouse ? 280 : 140;
    const xOffset = hasSpouse ? -140 : -70;

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

      const photoUrl =
        person.photo_url && person.photo_url.trim() !== ""
          ? person.photo_url
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

    if (hasSpouse) {
      drawPerson(d.data, -70);
      drawPerson(d.data.spouse_data, 70);

      // Garis pemisah antar pasangan
      nodeGroup
        .append("line")
        .attr("x1", 0)
        .attr("y1", 20)
        .attr("x2", 0)
        .attr("y2", 140)
        .attr("stroke", "#eee")
        .attr("stroke-dasharray", "4");
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
  const photoUrl =
    person.photo_url && person.photo_url.trim() !== ""
      ? person.photo_url
      : "./images/placeholder.png";
  modalPhoto.src = photoUrl;
  modalPhoto.onerror = function () {
    this.src = "./images/placeholder.png";
  };

  // Set basic info
  document.getElementById("modalName").textContent = person.name;
  document.getElementById("modalGeneration").textContent =
    person.id.split("-")[0];
  document.getElementById("modalGeneration").style.backgroundColor =
    generationColors[person.id.split("-")[0]] || "#95a5a6";
  document.getElementById("modalGender").textContent = person.gender || "-";
  document.getElementById("modalPob").textContent = person.pob || "-";
  document.getElementById("modalDob").textContent = person.dob
    ? formatDate(person.dob)
    : "-";
  document.getElementById("modalDod").textContent = person.dod
    ? formatDate(person.dod)
    : "Masih Hidup";
  document.getElementById("modalBurial").textContent =
    person.burial_place || "-";
  document.getElementById("modalProfession").textContent =
    person.profession || "-";
  document.getElementById("modalEducation").textContent =
    person.education || "-";
  document.getElementById("modalBio").textContent = person.bio || "-";

  // Marriage info
  const marriageSection = document.getElementById("marriageSection");
  const btnSpouse = document.getElementById("btnSpouse");

  if (person.marriage_info) {
    marriageSection.style.display = "block";
    document.getElementById("modalMarriage").textContent =
      `Pasangan: ${person.marriage_info.spouse_name} (${person.marriage_info.marriage_date})`;
    btnSpouse.disabled = false;
    btnSpouse.onclick = function () {
      viewSpouse();
    };
  } else {
    marriageSection.style.display = "none";
    btnSpouse.disabled = true;
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

function viewSpouse() {
  if (!currentPerson || !currentPerson.marriage_info) return;

  const spouseId = currentPerson.marriage_info.spouse_id;
  const spouse = familyData.find((p) => p.id === spouseId);

  if (spouse) {
    spousePerson = currentPerson;
    showModal(spouse);
  }
}

// Close modal when clicking outside
document.addEventListener("click", function (event) {
  const modal = document.getElementById("detailModal");
  if (event.target === modal) {
    closeModal();
  }
});
