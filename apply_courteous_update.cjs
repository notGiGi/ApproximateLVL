const fs = require('fs');
const path = 'c:/Users/FLEX/approximatelvl-simulator/src/SimulationEngine.js';
let text = fs.readFileSync(path, 'latin1');

text = text.replace('    let singleRoundFactor;\r\n\r\n    if (algorithm === "AMP") {', '    let singleRoundFactor;\r\n\r\n    if (algorithm === "COURTEOUS COUPLED") {\r\n      return null;\r\n    }\r\n\r\n    if (algorithm === "AMP") {');
text = text.replace('      case "COURTEOUS":\r\n        // Ecuación teórica EXACTA del paper para Courteous\r\n        return 1 - 2*p + 4*Math.pow(p, 2) - 4*Math.pow(p, 3) + Math.pow(p, 4);\r\n        \r\n      case "SELFISH":', '      case "COURTEOUS":\r\n        // Ecuación teórica EXACTA del paper para Courteous\r\n        return 1 - 2*p + 4*Math.pow(p, 2) - 4*Math.pow(p, 3) + Math.pow(p, 4);\r\n        \r\n      case "COURTEOUS COUPLED":\r\n        return null;\r\n        \r\n      case "SELFISH":');
fs.writeFileSync(path, text, 'latin1');
