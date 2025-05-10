// Step 1: Format your Dijkstra implementation for better readability
// dijkstra.js
function findShortestPath(edges, startNode, endNode, useTime = true) {
  const distances = {};
  const times = {};
  const previous = {};
  const unvisited = new Set();
  
  // Initialize distances and times
  Object.keys(edges).forEach(node => {
    distances[node] = Infinity;
    times[node] = Infinity;
    previous[node] = null;
    unvisited.add(node);
  });
  
  distances[startNode] = 0;
  times[startNode] = 0;
  
  while (unvisited.size) {
    // Get the unvisited node with the smallest metric
    const current = [...unvisited].reduce((minNode, node) => {
      const metric = useTime ? times[node] : distances[node];
      return metric < (useTime ? times[minNode] : distances[minNode]) ? node : minNode;
    });
    
    if (current === endNode || distances[current] === Infinity) break;
    
    unvisited.delete(current);
    
    // Update neighbors
    for (const { node: neighbor, distance, travelTime } of edges[current] || []) {
      if (!unvisited.has(neighbor)) continue;
      const newDistance = distances[current] + distance;
      const newTime = times[current] + (travelTime || distance / 50); // Default travelTime if not provided
      
      if (useTime && newTime < times[neighbor] || !useTime && newDistance < distances[neighbor]) {
        distances[neighbor] = newDistance;
        times[neighbor] = newTime;
        previous[neighbor] = current;
      }
    }
  }
  
  // Reconstruct the path
  const path = [];
  let current = endNode;
  while (current) {
    path.unshift(current);
    current = previous[current];
  }
  
  if (previous[endNode] === null) return null;
  
  return {
    path,
    distance: distances[endNode],
    travelTime: times[endNode],
    metric: useTime ? times[endNode] : distances[endNode],
  };
}

module.exports = { findShortestPath };

