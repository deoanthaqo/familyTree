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
    'G0': '#e74c3c',
    'G1': '#f39c12',
    'G2': '#27ae60',
    'G3': '#3498db'
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
    try {
        const response = await fetch('./js/data.json');
        const data = await response.json();
        familyData = data.family;
        
        // Build hierarchy and render tree
        const root = buildHierarchy(familyData);
        renderTree(root);
    } catch (error) {
        console.error('Error loading family data:', error);
    }
});

// ============================================
// HIERARCHY BUILDER
// ============================================

function buildHierarchy(flatData) {
    // Create a map for quick lookup
    const nodeMap = {};
    flatData.forEach(person => {
        nodeMap[person.id] = { ...person, children: [] };
    });

    // Find root nodes (G0 - no parents in dataset)
    const roots = [];
    flatData.forEach(person => {
        const node = nodeMap[person.id];
        
        // Check if this person has parents in the dataset
        const hasParentsInDataset = person.parents_id.some(pid => nodeMap[pid]);
        
        if (!hasParentsInDataset) {
            roots.push(node);
        } else {
            // Add as child to first parent found
            const parentId = person.parents_id.find(pid => nodeMap[pid]);
            if (parentId && nodeMap[parentId]) {
                nodeMap[parentId].children.push(node);
            }
        }
    });

    // If multiple roots, create a virtual root
    if (roots.length === 1) {
        return roots[0];
    } else {
        return {
            id: 'root',
            name: 'Keluarga Besar',
            gender: '',
            generation: '',
            children: roots,
            isVirtual: true
        };
    }
}

// ============================================
// TREE RENDERING
// ============================================

function renderTree(rootData) {
    const container = document.querySelector('.tree-container');
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Clear existing SVG
    d3.select('#tree-svg').selectAll('*').remove();

    svg = d3.select('#tree-svg')
        .attr('width', width)
        .attr('height', height);

    // Create a group for the tree
    g = svg.append('g');

    // Setup zoom behavior
    zoomBehavior = d3.zoom()
        .scaleExtent([0.3, 3])
        .on('zoom', (event) => {
            g.attr('transform', event.transform);
        });

    svg.call(zoomBehavior);

    // Create tree layout
    const treeLayout = d3.tree()
        .nodeSize([180, 220])
        .separation((a, b) => (a.parent === b.parent ? 1.2 : 1.5));

    const root = d3.hierarchy(rootData);
    treeLayout(root);

    // Center the tree
    const initialTransform = d3.zoomIdentity
        .translate(width / 2, 80)
        .scale(0.8);
    
    svg.call(zoomBehavior.transform, initialTransform);

    // Draw links
    const links = g.selectAll('.link')
        .data(root.links())
        .enter()
        .append('path')
        .attr('class', 'link')
        .attr('d', d3.linkVertical()
            .x(d => d.x)
            .y(d => d.y)
        );

    // Draw nodes
    const nodes = g.selectAll('.node')
        .data(root.descendants())
        .enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', d => `translate(${d.x}, ${d.y})`)
        .on('click', (event, d) => {
            event.stopPropagation();
            if (!d.data.isVirtual) {
                showModal(d.data);
            }
        });

    // Skip rendering for virtual root
    nodes.each(function(d) {
        if (d.data.isVirtual) {
            d3.select(this).style('display', 'none');
            return;
        }

        const nodeGroup = d3.select(this);
        const generation = d.data.id.split('-')[0];

        // Node card background
        nodeGroup.append('rect')
            .attr('class', 'node-rect')
            .attr('x', -70)
            .attr('y', 0)
            .attr('width', 140)
            .attr('height', 160)
            .attr('rx', 10);

        // Photo circle background
        nodeGroup.append('circle')
            .attr('class', 'node-photo-circle')
            .attr('cx', 0)
            .attr('cy', 45)
            .attr('r', 38);

        // Photo clip path
        const clipId = `clip-${d.data.id}`;
        svg.append('defs')
            .append('clipPath')
            .attr('id', clipId)
            .append('circle')
            .attr('cx', 0)
            .attr('cy', 45)
            .attr('r', 35);

        // Photo image
        const photoUrl = d.data.photo_url && d.data.photo_url.trim() !== '' 
            ? d.data.photo_url 
            : './images/placeholder.png';

        nodeGroup.append('image')
            .attr('class', 'node-photo')
            .attr('x', -35)
            .attr('y', 10)
            .attr('width', 70)
            .attr('height', 70)
            .attr('clip-path', `url(#${clipId})`)
            .attr('href', photoUrl)
            .on('error', function() {
                d3.select(this).attr('href', './images/placeholder.png');
            });

        // Generation badge
        nodeGroup.append('rect')
            .attr('class', 'generation-badge')
            .attr('x', -20)
            .attr('y', 85)
            .attr('width', 40)
            .attr('height', 18)
            .attr('rx', 9)
            .attr('fill', generationColors[generation] || '#95a5a6');

        nodeGroup.append('text')
            .attr('class', 'node-generation')
            .attr('x', 0)
            .attr('y', 98)
            .text(generation);

        // Name
        nodeGroup.append('text')
            .attr('class', 'node-name')
            .attr('x', 0)
            .attr('y', 120)
            .text(truncateText(d.data.name, 14));

        // Gender
        nodeGroup.append('text')
            .attr('class', 'node-gender')
            .attr('x', 0)
            .attr('y', 138)
            .text(d.data.gender);

        // Add gender icon
        const genderIcon = d.data.gender === 'Laki-laki' ? '♂' : '♀';
        const genderColor = d.data.gender === 'Laki-laki' ? '#3498db' : '#e91e63';
        
        nodeGroup.append('circle')
            .attr('cx', 0)
            .attr('cy', 152)
            .attr('r', 8)
            .attr('fill', genderColor)
            .attr('opacity', 0.2);

        nodeGroup.append('text')
            .attr('x', 0)
            .attr('y', 156)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('fill', genderColor)
            .text(genderIcon);
    });
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    return date.toLocaleDateString('id-ID', options);
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
    const container = document.querySelector('.tree-container');
    const width = container.clientWidth;
    
    svg.transition().duration(500).call(
        zoomBehavior.transform,
        d3.zoomIdentity.translate(width / 2, 80).scale(0.8)
    );
}

// ============================================
// MODAL FUNCTIONS
// ============================================

function showModal(person) {
    currentPerson = person;
    spousePerson = null;

    const modal = document.getElementById('detailModal');
    
    // Set photo with error handling
    const modalPhoto = document.getElementById('modalPhoto');
    const photoUrl = person.photo_url && person.photo_url.trim() !== ''
