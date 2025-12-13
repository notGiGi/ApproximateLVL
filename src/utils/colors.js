// Utility colors and helpers
export const getProcessColor = (index) => {
  const colors = [
    "#3498db", "#e67e22", "#2ecc71", "#9b59b6", "#e74c3c",
    "#f39c12", "#1abc9c", "#34495e", "#d35400", "#27ae60"
  ];
  return colors[index % colors.length];
};

export const ALICE_COLOR = "#3498db";
export const BOB_COLOR = "#e67e22";
export const CHARLIE_COLOR = "#2ecc71";
