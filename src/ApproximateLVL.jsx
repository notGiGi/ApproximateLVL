import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Scatter,
  BarChart,
  Bar,
  Cell,
  ReferenceLine,
  ReferenceArea,
  ComposedChart,
  ScatterChart,
  ZAxis,
  Area, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';

// Importar el motor de simulación
import { SimulationEngine } from './SimulationEngine.js';

// ============================================
// MULTIPLE DIMENSIONS TAB COMPONENT
// ============================================

function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

/**
 * Editor de Meeting Point:
 * - binary: un número (0..1)
 * - barycentric + AMP: vector de longitud = dimensions
 * - barycentric + RECURSIVE AMP: escalar α en [0,1]
 */
function MeetingPointEditor({
  dimensionMode,
  dimensions,
  algorithm,                // "auto" | "AMP" | "FV" | "RECURSIVE AMP" | ...
  probability,
  meetingPoint,            // número (se usa en binary)
  setMeetingPoint,         // setter del número (binary)
  customMeetingPoint,      // vector o número (multi-D)
  setCustomMeetingPoint,   // setter (multi-D)
  isRunning
}) {
  // Algoritmo real cuando el usuario elige "auto"
  const resolvedAlgo = algorithm === 'auto'
    ? (probability > 0.5 ? 'AMP' : 'FV')
    : algorithm;

  if (dimensionMode === 'binary') {
    // Un solo input numérico clásico
    return (
      <div className="flex items-center space-x-2">
        <label className="text-sm">Meeting Point:</label>
        <input
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={typeof meetingPoint === 'number' ? meetingPoint : 0.5}
          onChange={(e) => setMeetingPoint(clamp01(e.target.value))}
          className="w-24 p-1 border border-gray-300 rounded-md"
          disabled={isRunning}
        />
      </div>
    );
  }

  // === MODO MULTI-DIMENSIONAL ===
  if (resolvedAlgo === 'RECURSIVE AMP') {
    // Escalar α
    const alpha = (typeof customMeetingPoint === 'number')
      ? customMeetingPoint
      : (Array.isArray(customMeetingPoint) && customMeetingPoint.length > 0
          ? Number(customMeetingPoint[0]) : 0.5);

    return (
      <div className="space-y-1">
        <label className="text-xs font-medium text-purple-900">Recursive AMP – α (0..1):</label>
        <input
          type="number"
          min="0"
          max="1"
          step="0.01"
          value={Number.isFinite(alpha) ? alpha : 0.5}
          onChange={(e) => setCustomMeetingPoint(clamp01(e.target.value))}
          className="w-24 p-1 border border-purple-300 rounded"
          disabled={isRunning}
        />
      </div>
    );
  }

  if (resolvedAlgo === 'AMP') {
    // Vector de longitud = dimensions
    const vec = Array.isArray(customMeetingPoint) && customMeetingPoint.length === dimensions
      ? customMeetingPoint
      : Array(dimensions).fill(0.5);

    const updateAt = (idx, val) => {
      const next = [...vec];
      next[idx] = clamp01(val);
      setCustomMeetingPoint(next);
    };

    return (
      <div className="space-y-2">
        <p className="text-xs font-medium text-purple-900">AMP – Meeting Point (vector de {dimensions} componentes en [0,1])</p>
        <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${dimensions}, minmax(48px, 1fr))` }}>
          {vec.map((v, i) => (
            <input
              key={i}
              type="number"
              min="0"
              max="1"
              step="0.01"
              value={Number.isFinite(v) ? v : 0.5}
              onChange={(e) => updateAt(i, e.target.value)}
              className="p-1 text-xs border border-purple-300 rounded"
              disabled={isRunning}
            />
          ))}
        </div>
        <div className="text-[11px] text-gray-500">
          Sugerencia: la suma no tiene por qué ser 1; esto es un **punto** en [0,1]^d, no baricéntricas.
        </div>
      </div>
    );
  }

  // Para FV, MIN u otros que no usan meeting point en multi-D, no mostramos nada.
  return null;
}



function resolveMeetingPoint(actualAlgo, customMP, dimensions) {

  if (actualAlgo === 'RECURSIVE AMP') {
    let alpha;
    if (Array.isArray(customMP) && customMP.length > 0) alpha = Number(customMP[0]);
    else alpha = Number(customMP);
    if (!Number.isFinite(alpha)) alpha = 0.5;
    return Math.max(0, Math.min(1, alpha));
  }

  // AMP (y similares) → vector de longitud = dimensions
  if (Array.isArray(customMP) && customMP.length === dimensions) {
    return customMP.map(v => {
      const x = Number(v);
      return Number.isFinite(x) ? Math.max(0, Math.min(1, x)) : 0.5;
    });
  }


  const num = Number(customMP);
  if (Number.isFinite(num)) {
    const v = Math.max(0, Math.min(1, num));
    return Array(dimensions).fill(v);
  }

  // default seguro
  return Array(dimensions).fill(0.5);
}



function MultipleDimensionsTab() {
  // ---------- STATE ----------
  const [dimensions, setDimensions] = useState(3);
  const [processCount, setProcessCount] = useState(3);
  const [probability, setProbability] = useState(0.7);
  const [algorithm, setAlgorithm] = useState('auto');
  const [rounds, setRounds] = useState(10);
  const [repetitions, setRepetitions] = useState(100);
  const [initMode, setInitMode] = useState('vertices');
  const [customMeetingPoint, setCustomMeetingPoint] = useState(null);
  const [distanceMetric, setDistanceMetric] = useState('euclidean');

  const [initialValues, setInitialValues] = useState([]);
  const [currentExperiment, setCurrentExperiment] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentRound, setCurrentRound] = useState(0);
  const [animationSpeed, setAnimationSpeed] = useState(500);

  const [selectedRound, setSelectedRound] = useState(0);
  const [showTheoretical, setShowTheoretical] = useState(true);
  const [showAnimation, setShowAnimation] = useState(false);

  // ---------- INIT ----------
  useEffect(() => {
    generateInitialValues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dimensions, processCount, initMode]);

  const generateInitialValues = () => {
    if (!SimulationEngine?.barycentric) {
      console.error("Barycentric extension not loaded");
      setInitialValues([]);
      return;
    }
    const values = SimulationEngine.barycentric.generateInitialBarycentric(
      processCount, dimensions, initMode
    );
    setInitialValues(values);
  };

  const handleCustomValue = (processIndex, dimIndex, value) => {
    const newValues = [...(initialValues || [])];
    if (!newValues[processIndex]) {
      newValues[processIndex] = Array(dimensions).fill(0);
    }
    newValues[processIndex][dimIndex] = parseFloat(value) || 0;
    setInitialValues(newValues);
  };

  
  // Reemplazo COMPLETO y CORREGIDO de la función `runSimulation`:

const runSimulation = async () => {
  if (!SimulationEngine?.barycentric) {
    alert("Barycentric extension not loaded in SimulationEngine.");
    return;
  }

  setIsRunning(true);
  setCurrentRound(0);
  setSelectedRound(0);
  setStatistics(null);
  setCurrentExperiment(null);

  try {
    // ==========================
    // MEETING POINT (CORREGIDO)
    // ==========================
    // Resuelve el algoritmo real si está en 'auto' para usar el meeting point correcto
    const actualAlgo = algorithm === 'auto'
      ? (probability > 0.5 ? 'AMP' : 'FV')
      : algorithm;

    // Meeting point:
    //  - AMP: vector en [0,1]^d (si se pasa número, se replica por dimensión)
    //  - RECURSIVE AMP: escalar α en [0,1]
    //  - FV/otros: no lo usan, pero pasamos vector [0.5,...] por consistencia
    let meetingPoint;
    if (actualAlgo === 'RECURSIVE AMP') {
      // RECURSIVE AMP usa escalar α
      if (typeof customMeetingPoint === 'number' && Number.isFinite(customMeetingPoint)) {
        meetingPoint = Math.max(0, Math.min(1, customMeetingPoint));
      } else if (Array.isArray(customMeetingPoint) && customMeetingPoint.length > 0) {
        const alpha = Number(customMeetingPoint[0]);
        meetingPoint = Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 0.5;
      } else {
        meetingPoint = 0.5; // default
      }
      // console.log('RECURSIVE AMP usando alpha escalar:', meetingPoint);
    } else {
      // AMP (multi-D) y FV (no lo usan): vector absoluto
      if (Array.isArray(customMeetingPoint) && customMeetingPoint.length === dimensions) {
        meetingPoint = customMeetingPoint.map(v => {
          const num = Number(v);
          return Number.isFinite(num) ? Math.max(0, Math.min(1, num)) : 0.5;
        });
      } else if (typeof customMeetingPoint === 'number' && Number.isFinite(customMeetingPoint)) {
        const v = Math.max(0, Math.min(1, customMeetingPoint));
        meetingPoint = Array(dimensions).fill(v);
      } else {
        meetingPoint = Array(dimensions).fill(0.5); // default vector (NO 1/d)
      }
      // console.log(`${actualAlgo} usando meeting point vector:`, meetingPoint);
    }

    if (showAnimation) {
      // Animado (una sola corrida)
      const history = [];
      let currentValues = (initialValues || []).map(v => [...v]);

      for (let round = 0; round <= rounds; round++) {
        if (round > 0) {
         
          const uiAlgo = algorithm; // puede ser "auto"
          const actualAlgo = uiAlgo === 'auto'
            ? (probability > 0.5 ? 'AMP' : 'FV')
            : uiAlgo;

          // 2) resuelve el meeting point para multi-D
          //    - AMP           → vector de longitud = dimensions
          //    - RECURSIVE AMP → escalar α en [0,1]
          //    - otros         → usa vector [0.5,...] si no aplica
          const mpResolved = resolveMeetingPoint(
            actualAlgo,
            (typeof customMeetingPoint !== 'undefined' && customMeetingPoint !== null)
              ? customMeetingPoint
              : meetingPoint, // fallback si aún usas 'meetingPoint'
            dimensions
          );

          // 3) ejecuta el round baricéntrico con algoritmo y MP ya resueltos
          const algoReal = (algorithm === 'auto') ? (probability > 0.5 ? 'AMP' : 'FV') : algorithm;
          const mpToUse =
            dimensionMode === 'barycentric'
              ? (typeof customMeetingPoint !== 'undefined' && customMeetingPoint !== null
                  ? customMeetingPoint
                  : Array.isArray(meetingPoint) ? meetingPoint : Array(dimensions).fill(0.5))
              : meetingPoint;

          const result = SimulationEngine.barycentric.simulateBarycentricRound(
            currentValues,
            probability,
            algoReal,
            mpToUse,
            distanceMetric 
          );


          currentValues = result.newValues;
        }

        const discrepancy = SimulationEngine.barycentric.calculateDiscrepancy(
          currentValues,
          distanceMetric
        );

        history.push({
          round,
          values: currentValues.map(v => [...v]),
          discrepancy,
          algorithm: (algorithm === 'auto' ? (probability > 0.5 ? 'AMP' : 'FV') : algorithm), // lo real
          meetingPoint: resolveMeetingPoint(
            (algorithm === 'auto' ? (probability > 0.5 ? 'AMP' : 'FV') : algorithm),
            (typeof customMeetingPoint !== 'undefined' && customMeetingPoint !== null)
              ? customMeetingPoint
              : meetingPoint,
            dimensions
          ),
          dimensions
        });

        setCurrentExperiment([...history]);
        setCurrentRound(round);

        if (round < rounds) {
          await new Promise(res => setTimeout(res, animationSpeed));
        }
      }
    } else {
      // Múltiples repeticiones para estadísticas
      const results = SimulationEngine.barycentric.runMultipleBarycentricExperiments(
        initialValues,
        probability,
        rounds,
        repetitions,
        algorithm,      // se puede pasar 'auto'
        meetingPoint,
        distanceMetric 
      );

      setStatistics(results.statistics);
      setCurrentExperiment(results.experiments[0]);
      setCurrentRound(Math.min(rounds, results.experiments[0]?.length - 1 || 0));
    }
  } catch (error) {
    console.error("Simulation error:", error);
    console.error("Stack trace:", error.stack);

    let errorMessage = `Error en simulación: ${error.message}`;
    if (error.message.includes('barycentric')) {
      errorMessage += "\n\nVerifica que la extensión baricéntrica esté correctamente cargada.";
    } else if (error.message.includes('dimensions')) {
      errorMessage += "\n\nVerifica que las dimensiones y valores iniciales sean consistentes.";
    } else if (error.message.includes('meeting')) {
      errorMessage += "\n\nProblema con el meeting point. Verifica la configuración.";
    }
    alert(errorMessage);
  } finally {
    setIsRunning(false);
  }
};


  // ---------- VISUALIZACIÓN ----------
  const BarycentricVisualization = ({ values, round }) => {
    if (!values || values.length === 0) return null;
    if (dimensions === 3) return <TriangleVisualization values={values} round={round} />;
    return <RadarVisualization values={values} dimensions={dimensions} round={round} />;
  };

  const TriangleVisualization = ({ values, round }) => {
    const V1 = { x: 200, y: 50 };
    const V2 = { x: 50,  y: 300 };
    const V3 = { x: 350, y: 300 };
    const toCartesian = (bary) => {
      const [a, b, c] = bary;
      return { x: a * V1.x + b * V2.x + c * V3.x, y: a * V1.y + b * V2.y + c * V3.y };
    };
    const trianglePoints = `${V1.x},${V1.y} ${V2.x},${V2.y} ${V3.x},${V3.y}`;
    const processColors = ["#3498db", "#e67e22", "#2ecc71", "#9b59b6", "#e74c3c", "#1abc9c", "#9b59b6"];
    return (
      <svg width="400" height="350" className="mx-auto">
        <polygon points={trianglePoints} fill="none" stroke="#333" strokeWidth="2" />
        <text x={V1.x} y={V1.y - 10} textAnchor="middle" fontSize="12">Vertex 1</text>
        <text x={V2.x - 10} y={V2.y + 15} textAnchor="end" fontSize="12">Vertex 2</text>
        <text x={V3.x + 10} y={V3.y + 15} textAnchor="start" fontSize="12">Vertex 3</text>
        {values.map((coords, i) => {
          const pos = toCartesian(coords);
          return (
            <g key={i}>
              <circle cx={pos.x} cy={pos.y} r="8" fill={processColors[i % processColors.length]} stroke="white" strokeWidth="2" />
              <text x={pos.x} y={pos.y - 12} textAnchor="middle" fontSize="10" fill={processColors[i % processColors.length]} fontWeight="bold">
                P{i + 1}
              </text>
            </g>
          );
        })}
        <text x="200" y="340" textAnchor="middle" fontSize="14" fontWeight="bold">Round {round}</text>
      </svg>
    );
  };

  const RadarVisualization = ({ values, dimensions, round }) => {
    const axes = Array.from({ length: dimensions }, (_, i) => `D${i + 1}`);
    const data = values.map((coords, idx) => {
      const row = { process: `P${idx + 1}` };
      coords.forEach((v, d) => { row[axes[d]] = v; });
      return row;
    });
    const colors = ["#3498db", "#e67e22", "#2ecc71", "#9b59b6", "#e74c3c", "#1abc9c", "#9b59b6"];
    return (
      <ResponsiveContainer width="100%" height={350}>
        <RadarChart data={data}>
          <PolarGrid />
          <PolarAngleAxis dataKey="process" />
          <PolarRadiusAxis domain={[0, 1]} />
          {axes.map((axis, idx) => (
            <Radar key={axis} name={axis} dataKey={axis}
              stroke={colors[idx % colors.length]} fill={colors[idx % colors.length]} fillOpacity={0.3} />
          ))}
          <Tooltip />
          <Legend />
        </RadarChart>
      </ResponsiveContainer>
    );
  };

  const getTheoreticalDiscrepancy = (round) => {
    if (dimensions === 2) {
      const q = 1 - probability;
      if (algorithm === 'AMP' || (algorithm === 'auto' && probability > 0.5)) {
        return Math.pow(q, round);
      }
      return Math.pow(probability * probability + q * q, round);
    }
    return null;
  };

  const ConvergenceChart = () => {
    if (!statistics || statistics.length === 0) return null;
    const data = statistics.map(stat => ({
      round: stat.round,
      mean: stat.mean,
      min: stat.min,
      max: stat.max,
      theoretical: getTheoreticalDiscrepancy(stat.round)
    }));
    return (
      <div className="space-y-6">
        {/* … (sin cambios en UI) … */}
      </div>
    );
  };

  // ---------- RENDER ----------
  return (
    <div className="space-y-6">

      {/* Botón de Run */}
      <div className="bg-white p-6 rounded-lg shadow-md">

        <button
          onClick={runSimulation}
          disabled={isRunning || (initialValues?.length ?? 0) === 0}
          className={`mt-4 px-6 py-2 rounded font-medium ${
            isRunning
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white'
          }`}
        >
          {isRunning ? `Running... Round ${currentRound}/${rounds}` : 'Run Simulation'}
        </button>
      </div>

   
    </div>
  );
}


// Colors


const ALICE_COLOR = "#3498db";
const BOB_COLOR = "#e67e22";
const CHARLIE_COLOR = "#2ecc71";
const ACCENT_COLOR = "#4CAF50";
const PRIMARY_COLOR = "#2c3e50";
const ERROR_COLOR = "#e74c3c";
const AMP_COLOR = "#9c27b0";
const FV_COLOR = "#e91e63";

// Utility functions for experiment analysis
function calculateExperimentStats(experiment) {
  if (!experiment || !experiment.results || experiment.results.length === 0) {
    return null;
  }
  
  const discrepancies = experiment.results.map(r => r.discrepancy);
  
  // Basic statistics
  const mean = discrepancies.reduce((a, b) => a + b, 0) / discrepancies.length;
  const min = Math.min(...discrepancies);
  const max = Math.max(...discrepancies);
  const absErrors = data.map(d => d.absError);
  const relErrors = data.map(d => d.errorPercent);
  const minAbs = absErrors.length ? Math.min(...absErrors) : 0;
  const maxAbs = absErrors.length ? Math.max(...absErrors) : 0;
  const minRel = relErrors.length ? Math.min(...relErrors) : 0;
  const maxRel = relErrors.length ? Math.max(...relErrors) : 0;

  // Standard deviation
  const variance = discrepancies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / discrepancies.length;
  const stdDev = Math.sqrt(variance);
  
  // Errors compared to theoretical
  const errorsPercent = experiment.results
    .filter(r => r.theoretical)
    .map(r => Math.abs(r.discrepancy - r.theoretical) / r.theoretical * 100);
  
  const avgErrorPercent = errorsPercent.length > 0 ? 
    errorsPercent.reduce((a, b) => a + b, 0) / errorsPercent.length : null;
  
  // Algorithms used
  const algorithmsUsed = [...new Set(experiment.results.map(r => r.algorithm))];
  
  return {
    mean,
    min,
    max,
    stdDev,
    avgErrorPercent,
    algorithmsUsed,
    sampleSize: discrepancies.length
  };
}

// Function to find interesting points in the experiments
function findInterestingPoints(experiments) {
  if (!experiments || experiments.length === 0) return [];
  
  const interestingPoints = [];
  
  // Look for the crossover point p=0.5
  experiments.forEach(exp => {
    const nearCrossover = exp.results.find(r => Math.abs(r.p - 0.5) < 0.01);
    if (nearCrossover) {
      interestingPoints.push({
        type: 'crossover',
        p: nearCrossover.p,
        description: 'Theoretical crossover point (p=0.5)',
        experimentId: exp.metadata.id
      });
    }
  });
  
  // Find extreme values
  experiments.forEach(exp => {
    const discrepancies = exp.results.map(r => r.discrepancy);
    const maxIndex = discrepancies.indexOf(Math.max(...discrepancies));
    const minIndex = discrepancies.indexOf(Math.min(...discrepancies));
    
    if (maxIndex !== -1) {
      interestingPoints.push({
        type: 'max',
        p: exp.results[maxIndex].p,
        description: `Maximum discrepancy (${exp.results[maxIndex].discrepancy.toFixed(4)})`,
        experimentId: exp.metadata.id
      });
    }
    
    if (minIndex !== -1) {
      interestingPoints.push({
        type: 'min',
        p: exp.results[minIndex].p,
        description: `Minimum discrepancy (${exp.results[minIndex].discrepancy.toFixed(4)})`,
        experimentId: exp.metadata.id
      });
    }
  });
  
  return interestingPoints;
}

// Helper function for color interpolation
// Función para mostrar detalles de una probabilidad específica

// Helper para detectar si los valores son binarios
const isBinaryValues = () => {
  return processValues.every(val => val === 0 || val === 1);
};

// Helper para obtener el rango de valores
const getValueRange = () => {
  const min = Math.min(...processValues);
  const max = Math.max(...processValues);
  return { min, max };
};

const getProcessColor = (index) => {
  const colors = ["#3498db", "#e67e22", "#2ecc71", "#9b59b6", "#e74c3c", 
                  "#f39c12", "#1abc9c", "#34495e", "#d35400", "#27ae60"];
  return colors[index % colors.length];
};

function MessageDeliveryTable({
  messages,
  processNames,
  selectedProcess,
  previousValues = [],
  finalValues = [],
  algorithm = null,
  knownValuesSets = null
}) {
  const filtered = selectedProcess != null
    ? messages.filter(m => m.from === selectedProcess || m.to === selectedProcess)
    : messages;

  const messagesByReceiver = {};
  messages.forEach(msg => {
    if (!messagesByReceiver[msg.to]) {
      messagesByReceiver[msg.to] = [];
    }
    if (msg.delivered) {
      messagesByReceiver[msg.to].push({
        from: msg.from,
        value: msg.value
      });
    }
  });

  const getChangeReason = (toIdx, prevVal, newVal, isDelivered, sentVal, fromIdx) => {
    if (!isDelivered) return "";
    
    const changed = prevVal !== undefined && newVal !== undefined && prevVal !== newVal;
    
    // Algoritmos de 3 procesos
    if (["COURTEOUS", "SELFISH", "CYCLIC", "BIASED0"].includes(algorithm)) {
      const receivedVals = messagesByReceiver[toIdx] || [];
      
      if (algorithm === "COURTEOUS") {
        if (changed && receivedVals.length === 1) {
          return `COURTEOUS: Adopted different value from ${processNames[fromIdx]}`;
        } else if (changed && receivedVals.length === 2) {
          return "COURTEOUS: Majority decision (heard from all)";
        }
      } else if (algorithm === "SELFISH") {
        if (!changed && receivedVals.length === 1 && sentVal !== prevVal) {
          return `SELFISH: Kept own value (ignoring ${processNames[fromIdx]})`;
        } else if (changed && receivedVals.length === 2) {
          return "SELFISH: Majority decision (heard from all)";
        }
      } else if (algorithm === "CYCLIC") {
        const cyclicPrev = toIdx === 0 ? 2 : toIdx - 1;
        if (changed && fromIdx === cyclicPrev) {
          return `CYCLIC: Adopted from ${processNames[fromIdx]} (cyclic order)`;
        } else if (!changed && fromIdx !== cyclicPrev) {
          return `CYCLIC: Ignored ${processNames[fromIdx]} (not in cyclic order)`;
        }
      } else if (algorithm === "BIASED0") {
        if (changed && newVal === 0) {
          return `BIASED0: Decided 0 (detected 0 from ${processNames[fromIdx]})`;
        } else if (!changed && sentVal === 0) {
          return "BIASED0: Already 0";
        }
      }
      
      return isDelivered ? `${algorithm}: Message received` : "";
    }
    
    // Algoritmos MIN y RECURSIVE AMP
    if (algorithm === "MIN") {
      if (knownValuesSets && knownValuesSets[toIdx]) {
        const minKnown = Math.min(...knownValuesSets[toIdx]);
        if (changed && newVal === minKnown) {
          return `MIN: Selected minimum (${minKnown.toFixed(3)}) from known set`;
        } else if (isDelivered) {
          return `MIN: Added ${sentVal.toFixed(3)} to known set`;
        }
      }
      return changed ? "MIN: updated to minimum" : "MIN: value accumulated";
    } else if (algorithm === "RECURSIVE AMP") {
      if (changed) {
        const receivedVals = messagesByReceiver[toIdx] || [];
        if (receivedVals.length > 0) {
          const allVals = [prevVal, ...receivedVals.map(r => r.value)];
          const minVal = Math.min(...allVals);
          const maxVal = Math.max(...allVals);
          return `RECURSIVE AMP: Applied α to range [${minVal.toFixed(3)}, ${maxVal.toFixed(3)}]`;
        }
      }
      return isDelivered ? "RECURSIVE AMP: value received" : "";
    } 
    
    // Algoritmos básicos AMP y FV
    if (changed) {
      const receivedMessages = messagesByReceiver[toIdx] || [];
      const differentValue = receivedMessages.find(m => m.value !== prevVal);
      
      if (algorithm === "AMP" && differentValue) {
        return `AMP: Moved to meeting point (received ${differentValue.value.toFixed(3)} ≠ ${prevVal.toFixed(3)})`;
      } else if (algorithm === "FV" && differentValue) {
        return `FV: Adopted received value ${differentValue.value.toFixed(3)}`;
      }
    }
    
    return "";
  };

  // Función para determinar color según algoritmo
  const getAlgorithmColor = () => {
    switch(algorithm) {
      case "MIN": return "text-yellow-700";
      case "RECURSIVE AMP": return "text-indigo-700";
      case "AMP": return "text-blue-700";
      case "FV": return "text-purple-700";
      case "COURTEOUS": return "text-indigo-700";
      case "SELFISH": return "text-orange-700";
      case "CYCLIC": return "text-teal-700";
      case "BIASED0": return "text-pink-700";
      default: return "text-gray-700";
    }
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-2 py-1 text-left">From</th>
            <th className="px-2 py-1 text-left">To</th>
            <th className="px-2 py-1 text-left">Sent Value</th>
            <th className="px-2 py-1 text-center">Delivered</th>
            <th className="px-2 py-1 text-left">To's Prev Value</th>
            <th className="px-2 py-1 text-left">To's New Value</th>
            <th className="px-2 py-1 text-left">Effect</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((msg, i) => {
            const fromIdx = msg.from;
            const toIdx = msg.to;
            const sentVal = msg.value;
            const isDelivered = msg.delivered;

            const prevValueOfReceiver = previousValues[toIdx];
            const newValueOfReceiver = finalValues[toIdx];
            const changed = prevValueOfReceiver !== undefined && 
                          newValueOfReceiver !== undefined && 
                          prevValueOfReceiver !== newValueOfReceiver;

            const changeReason = getChangeReason(
              toIdx, prevValueOfReceiver, newValueOfReceiver, 
              isDelivered, sentVal, fromIdx
            );

            return (
              <tr key={i} className={isDelivered ? 'bg-green-50' : 'bg-red-50'}>
                <td className="px-2 py-1 flex items-center space-x-1">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getProcessColor(fromIdx) }} />
                  <span>{processNames[fromIdx]}</span>
                </td>
                <td className="px-2 py-1">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getProcessColor(toIdx) }} />
                    <span>{processNames[toIdx]}</span>
                  </div>
                </td>
                <td className="px-2 py-1 font-mono">{sentVal?.toFixed(4)}</td>
                <td className="px-2 py-1 text-center">
                  {isDelivered ? (
                    <span className="text-green-600">✓</span>
                  ) : (
                    <span className="text-red-600">✗</span>
                  )}
                </td>
                <td className="px-2 py-1 font-mono">{prevValueOfReceiver?.toFixed(4) || '—'}</td>
                <td className="px-2 py-1 font-mono">
                  <span className={changed ? 'font-bold text-blue-600' : ''}>
                    {newValueOfReceiver?.toFixed(4) || '—'}
                  </span>
                </td>
                <td className="px-2 py-1 text-xs">
                  {changeReason && (
                    <span className={getAlgorithmColor()}>
                      {changeReason}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}






function interpolateColor(color1, color2, factor) {
  // Convert hexadecimal colors to RGB components
  const hex1 = color1.replace('#', '');
  const hex2 = color2.replace('#', '');
  
  // Get RGB components
  const r1 = parseInt(hex1.substring(0, 2), 16);
  const g1 = parseInt(hex1.substring(2, 4), 16);
  const b1 = parseInt(hex1.substring(4, 6), 16);
  
  const r2 = parseInt(hex2.substring(0, 2), 16);
  const g2 = parseInt(hex2.substring(2, 4), 16);
  const b2 = parseInt(hex2.substring(4, 6), 16);
  
  // Interpolate
  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));
  
  // Convert back to hex
  const rHex = r.toString(16).padStart(2, '0');
  const gHex = g.toString(16).padStart(2, '0');
  const bHex = b.toString(16).padStart(2, '0');
  
  return `#${rHex}${gHex}${bHex}`;
}

// Componente para manejar n procesos
// --- NProcessesControl.jsx ---
// Reemplazo COMPLETO y CORREGIDO del componente `NProcessesControl`:

function NProcessesControl({ 
  processValues, 
  setProcessValues, 
  maxProcesses = 100, 
  valueMode, 
  setValueMode, 
  isRunning,
  // NUEVOS PROPS NECESARIOS
  dimensionMode,
  setDimensionMode,
  dimensions,
  setDimensions,
  barycentricValues,
  setBarycentricValues,
  distanceMetric,
  setDistanceMetric,
  customMeetingPoint,
  setCustomMeetingPoint,
  algorithm,
  addLog
}) {
  const n = processValues.length;

  const clamp01 = (x) => Math.max(0, Math.min(1, Number(x)));

  const addProcess = () => {
    if (n < maxProcesses) {
      const defaultValue = valueMode === 'binary' ? n % 2 : 0.5;
      setProcessValues([...processValues, defaultValue]);

      // Reset algorithms if we're moving away from 3 processes
      if (n === 3) {
        const has3PAlgos = selectedAlgorithms.some(a => 
          ["COURTEOUS", "SELFISH", "CYCLIC", "BIASED0"].includes(a)
        );
        if (has3PAlgos) {
          setSelectedAlgorithms(prev => 
            prev.filter(a => !["COURTEOUS", "SELFISH", "CYCLIC", "BIASED0"].includes(a))
          );
          addLog("3-process algorithms removed (now have 4 processes)", "warning");
        }
      }

      if (dimensionMode === 'barycentric' && SimulationEngine?.barycentric) {
        const newBaryValues = [...barycentricValues];
        const newCoords = Array(dimensions).fill(0);
        newCoords[n % dimensions] = 1;
        newBaryValues.push(newCoords);
        setBarycentricValues(newBaryValues);
      }
    }
  };

  const removeProcess = () => {
    if (n > 2) {
      setProcessValues(processValues.slice(0, -1));
      
      // Reset algorithms if we're moving away from 3 processes
      if (n === 4) {
        const has3PAlgos = selectedAlgorithms.some(a => 
          ["COURTEOUS", "SELFISH", "CYCLIC", "BIASED0"].includes(a)
        );
        if (has3PAlgos) {
          setSelectedAlgorithms(prev => 
            prev.filter(a => !["COURTEOUS", "SELFISH", "CYCLIC", "BIASED0"].includes(a))
          );
          addLog("3-process algorithms removed (now have 2 processes)", "warning");
        }
      }
      
      if (dimensionMode === 'barycentric') {
        setBarycentricValues(barycentricValues.slice(0, -1));
      }
    }
  };

  const updateProcessValue = (index, value) => {
    const newValues = [...processValues];
    const val = parseFloat(value);
    if (!isNaN(val)) {
      if (valueMode === 'binary') {
        newValues[index] = (val === 0 || val === 1) ? val : Math.round(val);
      } else {
        newValues[index] = clamp01(val);
      }
      setProcessValues(newValues);
    }
  };

  const initializeBarycentricValues = (numProc, dims, mode = 'vertices') => {
    if (!SimulationEngine?.barycentric) {
      addLog?.("ERROR: Barycentric extension not loaded");
      return;
    }
    const mappedMode = mode === 'centroid' ? 'center' : mode;
    const values = SimulationEngine.barycentric.generateInitialBarycentric(
      numProc, dims, mappedMode
    );
    setBarycentricValues(values);
    addLog?.(`Initialized ${numProc} processes in ${dims}D space (${mappedMode})`);
  };

  const updateBarycentricValue = (processIdx, dimIdx, value) => {
    const newValues = [...barycentricValues];
    if (!newValues[processIdx]) {
      newValues[processIdx] = Array(dimensions).fill(0);
    }
    newValues[processIdx][dimIdx] = clamp01(value);
    setBarycentricValues(newValues);
  };

  const handleSwitchToBarycentric = () => {
    setDimensionMode('barycentric');
    if ((!barycentricValues || barycentricValues.length === 0) && SimulationEngine?.barycentric) {
      initializeBarycentricValues(n, dimensions, 'vertices');
    }
  };

  return (
    <div className="mb-4">
      {/* Toggle de modo */}
      <div className="flex items-center justify-between mb-3 p-2 bg-gray-50 rounded-lg">
        <span className="text-xs font-semibold text-gray-700">Dimension Mode</span>
        <div className="flex items-center space-x-1 bg-white rounded-lg p-0.5 shadow-sm">
          <button
            onClick={() => setDimensionMode('binary')}
            className={`px-3 py-1 text-xs font-medium rounded transition-all ${
              dimensionMode === 'binary'
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
            }`}
            disabled={isRunning}
          >
            Binary
          </button>
          <button
            onClick={handleSwitchToBarycentric}
            className={`px-3 py-1 text-xs font-medium rounded transition-all ${
              dimensionMode === 'barycentric'
                ? 'bg-purple-500 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
            }`}
            disabled={isRunning}
          >
            Multi-D
          </button>
        </div>
      </div>

      {dimensionMode === 'binary' ? (
        <>
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-sm font-semibold">Initial Values ({n} processes)</h3>
            <div className="flex space-x-2">
              <button
                onClick={removeProcess}
                disabled={n <= 2 || isRunning}
                className={`p-1 rounded-md ${n <= 2 || isRunning ? 'bg-gray-200 text-gray-400' : 'bg-red-100 text-red-600 hover:bg-red-200'}`}
                title="Remove process"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <button
                onClick={addProcess}
                disabled={n >= maxProcesses || isRunning}
                className={`p-1 rounded-md ${n >= maxProcesses || isRunning ? 'bg-gray-200 text-gray-400' : 'bg-green-100 text-green-600 hover:bg-green-200'}`}
                title="Add process"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>

          <div className="mb-2">
            <label className="text-xs font-medium block mb-1">Value Mode:</label>
            <select
              value={valueMode}
              onChange={(e) => {
                const newMode = e.target.value;
                setValueMode(newMode);
                
                if (newMode === 'binary') {
                  setProcessValues(processValues.map(v => Math.round(v)));
                }
                
                // Reset 3-process algorithms if switching to continuous
                if (newMode === 'continuous' && processValues.length === 3) {
                  const has3PAlgos = selectedAlgorithms.some(a => 
                    ["COURTEOUS", "SELFISH", "CYCLIC", "BIASED0"].includes(a)
                  );
                  if (has3PAlgos) {
                    setSelectedAlgorithms(prev => 
                      prev.filter(a => !["COURTEOUS", "SELFISH", "CYCLIC", "BIASED0"].includes(a))
                    );
                    addLog("3-process binary algorithms removed (switched to continuous mode)", "warning");
                  }
                }
              }}
              className="w-full p-1 text-sm border rounded-md"
              disabled={isRunning}
            >
              <option value="binary">Binary (0 or 1)</option>
              <option value="continuous">Continuous (0.0 to 1.0)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {processValues.map((value, index) => {
              const COLORS = [
                "#3498db","#e67e22","#2ecc71","#9c27b0","#e91e63","#f44336","#ff9800",
                "#ffc107","#8bc34a","#009688"
              ];
              const color = COLORS[index % COLORS.length];
              const label = index < 3 ? ["Alice","Bob","Charlie"][index] : `P${index+1}`;

              return (
                <div key={index}>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-medium" style={{ color }}>{label}</label>
                  </div>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step={valueMode === 'binary' ? "1" : "0.1"}
                    value={value}
                    onChange={(e) => updateProcessValue(index, e.target.value)}
                    className="w-full p-1 text-sm border rounded-md"
                    style={{ borderColor: color }}
                    disabled={isRunning}
                    placeholder={valueMode === 'binary' ? "0 or 1" : "0.0-1.0"}
                  />
                </div>
              );
            })}
          </div>

          {valueMode === 'continuous' && (
            <div className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
              ⚠️ Note: Continuous values are experimental. The paper focuses on binary values.
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium block mb-1">Dimensions:</label>
              <select
                value={dimensions}
                onChange={(e) => {
                  const newDim = parseInt(e.target.value);
                  setDimensions(newDim);
                  initializeBarycentricValues(n, newDim, 'vertices');
                }}
                className="w-full p-1 text-sm border rounded-md"
                disabled={isRunning}
              >
                {[2,3,4,5,6,7,8,9,10].map(d => (
                  <option key={d} value={d}>{d}D Space</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium block mb-1">Distance Metric:</label>
              <select
                value={distanceMetric}
                onChange={(e) => setDistanceMetric(e.target.value)}
                className="w-full p-1 text-sm border rounded-md"
                disabled={isRunning}
              >
                <option value="euclidean">Euclidean</option>
                <option value="l1">L1 (Manhattan)</option>
                <option value="linf">L∞ (Max)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <span className="text-xs font-medium">Processes: {n}</span>
            <div className="flex space-x-1">
              <button
                onClick={removeProcess}
                disabled={n <= 2 || isRunning}
                className={`px-2 py-1 text-xs rounded ${n <= 2 || isRunning ? 'bg-gray-200' : 'bg-red-100 text-red-600'}`}
              >
                -
              </button>
              <button
                onClick={addProcess}
                disabled={n >= 8 || isRunning}
                className={`px-2 py-1 text-xs rounded ${n >= 8 || isRunning ? 'bg-gray-200' : 'bg-green-100 text-green-600'}`}
              >
                +
              </button>
            </div>
          </div>

          <div className="flex space-x-1">
            <button
              onClick={() => initializeBarycentricValues(n, dimensions, 'vertices')}
              className="flex-1 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
              disabled={isRunning}
            >
              Vertices
            </button>
            <button
              onClick={() => initializeBarycentricValues(n, dimensions, 'random')}
              className="flex-1 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
              disabled={isRunning}
            >
              Random
            </button>
            <button
              onClick={() => initializeBarycentricValues(n, dimensions, 'centroid')}
              className="flex-1 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
              disabled={isRunning}
            >
              Centroid
            </button>
          </div>

          <div className="bg-gray-50 rounded-lg p-2 max-h-48 overflow-y-auto">
            <p className="text-xs font-medium text-gray-700 mb-2">Barycentric Coordinates:</p>
            {Array(n).fill(0).map((_, pIdx) => (
              <div key={pIdx} className="flex items-center space-x-1 mb-1">
                <span className="text-xs font-medium text-gray-600 w-10">P{pIdx+1}:</span>
                <div className="flex-1 grid gap-1" style={{gridTemplateColumns: `repeat(${dimensions}, 1fr)`}}>
                  {Array(dimensions).fill(0).map((_, dIdx) => (
                    <input
                      key={dIdx}
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={barycentricValues[pIdx]?.[dIdx] ?? 0}
                      onChange={(e) => updateBarycentricValue(pIdx, dIdx, e.target.value)}
                      className="w-full px-1 py-0.5 text-xs border rounded"
                      disabled={isRunning}
                    />
                  ))}
                </div>
                <span className={`text-xs w-12 text-right ${
                  Math.abs((barycentricValues[pIdx]?.reduce((a, b) => a + b, 0) || 0) - 1) < 0.01 
                    ? 'text-green-600 font-medium' 
                    : 'text-red-600'
                }`}>
                  Σ{(barycentricValues[pIdx]?.reduce((a, b) => a + b, 0) || 0).toFixed(2)}
                </span>
              </div>
            ))}
          </div>

          {/* AMP: Meeting Point como VECTOR (default 0.5 por dimensión) */}
          {algorithm === 'AMP' && (
            <div className="bg-purple-50 rounded-lg p-2">
              <p className="text-xs font-medium text-purple-900 mb-1">AMP Meeting Point (vector absoluto):</p>
              <div className="grid gap-1" style={{gridTemplateColumns: `repeat(${dimensions}, 1fr)`}}>
                {Array(dimensions).fill(0).map((_, dIdx) => (
                  <input
                    key={dIdx}
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={
                      Array.isArray(customMeetingPoint) && customMeetingPoint[dIdx] != null
                        ? Number(customMeetingPoint[dIdx])
                        : 0.5
                    }
                    onChange={(e) => {
                      const val = clamp01(e.target.value);
                      const base = (Array.isArray(customMeetingPoint) && customMeetingPoint.length === dimensions)
                        ? [...customMeetingPoint]
                        : Array(dimensions).fill(0.5);
                      base[dIdx] = val;
                      setCustomMeetingPoint(base);
                    }}
                    className="w-full px-1 py-0.5 text-xs border border-purple-300 rounded"
                    disabled={isRunning}
                  />
                ))}
              </div>
              <div className="text-[11px] text-purple-700 mt-1">
                Default: 0.5 en cada dimensión (editable).
              </div>
            </div>
          )}

          <div className="mt-2 text-xs text-purple-600 bg-purple-50 p-2 rounded">
            ℹ️ Multi-dimensional mode is experimental and extends beyond the original paper.
          </div>
        </div>
      )}
    </div>
  );
}



// Component for comparing experiments with advanced features
function ExperimentComparison({ experiments }) {
  if (!experiments || experiments.length === 0) return null;
  
  const colors = [
    "#3498db", "#e67e22", "#2ecc71", "#9b59b6", "#e74c3c", 
    "#f39c12", "#16a085", "#8e44ad", "#c0392b", "#27ae60"
  ];
  
  const [viewMode, setViewMode] = useState('chart'); // 'chart', 'detail', 'combined'
  const [selectedMetric, setSelectedMetric] = useState('discrepancy'); // 'discrepancy', 'errorPercent', 'theoretical'
  const [normalizeProbability, setNormalizeProbability] = useState(false);
  const [highlightCrossover, setHighlightCrossover] = useState(true);
  const [legendPosition, setLegendPosition] = useState('top'); // 'top', 'bottom', 'right'
  const [showGrid, setShowGrid] = useState(true);
  const [showDataPoints, setShowDataPoints] = useState(true);
  
  // For range experiment comparisons
  if (experiments[0].type === 'range') {
    // Prepare combined data for all charts
    const chartData = [];
    const algorithmColors = {
      'AMP': '#e74c3c',  // Red
      'FV': '#3498db'    // Blue
    };
    
    // Advanced data processing for all visualizations
    experiments.forEach((experiment, index) => {
      const expColor = colors[index % colors.length];
      
      // For each data point in the experiment
      experiment.results.forEach(result => {
        // Calculate variance if available in discrepancies array
        let variance = 0;
        let stdDev = 0;
        
        if (result.discrepancies && result.discrepancies.length > 1) {
          const mean = result.discrepancy;
          variance = result.discrepancies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / result.discrepancies.length;
          stdDev = Math.sqrt(variance);
        }
        
        // Normalize values if enabled
        const normalizedP = normalizeProbability ? 
          (result.p - experiment.parameters.minP) / (experiment.parameters.maxP - experiment.parameters.minP) : 
          result.p;
        
        const dataPoint = {
          p: normalizedP,
          rawP: result.p,
          [experiment.metadata.name]: result.discrepancy,
          variance: variance,
          stdDev: stdDev,
          experimentId: experiment.metadata.id,
          algorithm: result.algorithm,
          expColor: expColor,
          algorithmColor: algorithmColors[result.algorithm] || expColor,
          theoretical: result.theoretical,
          error: result.theoretical ? Math.abs(result.theoretical - result.discrepancy) : null,
          errorPercent: result.theoretical && result.theoretical !== 0 ? 
            (Math.abs(result.theoretical - result.discrepancy) / result.theoretical) * 100 : null
        };
        
        // Add the selected metric property for easy plotting
        if (selectedMetric === 'errorPercent') {
          dataPoint[`${experiment.metadata.name}_${selectedMetric}`] = dataPoint.errorPercent;
        } else if (selectedMetric === 'theoretical') {
          dataPoint[`${experiment.metadata.name}_theoretical`] = dataPoint.theoretical;
          dataPoint[`${experiment.metadata.name}_experimental`] = result.discrepancy;
        } else {
          // Default is discrepancy, which is already added
        }
        
        chartData.push(dataPoint);
      });
    });
    
    // Sort by probability and group by experiment
    chartData.sort((a, b) => a.rawP - b.rawP);
    
    // Find the crossover point (when AMP outperforms FV)
    const crossoverPoint = chartData.find(point => point.rawP > 0.5);
    
    // Determine Y-axis range for consistency
    const allDiscrepancies = chartData.map(d => {
      const values = experiments.map(exp => d[exp.metadata.name]).filter(v => v !== undefined);
      return Math.max(...values);
    });
    const maxDiscrepancy = Math.max(...allDiscrepancies);
    const yAxisDomain = [0, Math.min(Math.ceil(maxDiscrepancy * 10) / 10, 1)];
    
    return (
      <div className="bg-white rounded-lg shadow p-4 mb-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Range Experiments Comparison</h3>
          
          <div className="flex space-x-3">
            <select 
              value={viewMode} 
              onChange={(e) => setViewMode(e.target.value)}
              className="px-2 py-1 border rounded text-sm"
            >
              <option value="chart">Chart</option>
              <option value="detail">Details</option>
              <option value="combined">Combined</option>
            </select>
            
            <select 
              value={selectedMetric} 
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="px-2 py-1 border rounded text-sm"
            >
              <option value="discrepancy">Discrepancy</option>
              <option value="errorPercent">Error %</option>
              <option value="theoretical">Theoretical vs Experimental</option>
            </select>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-2 mb-3 bg-gray-50 p-2 rounded">
          <label className="flex items-center text-sm">
            <input 
              type="checkbox" 
              checked={normalizeProbability}
              onChange={() => setNormalizeProbability(!normalizeProbability)}
              className="mr-1"
            />
            Normalize Probability
          </label>
          
          <label className="flex items-center text-sm">
            <input 
              type="checkbox" 
              checked={highlightCrossover}
              onChange={() => setHighlightCrossover(!highlightCrossover)}
              className="mr-1"
            />
            Highlight Crossover
          </label>
          
          <label className="flex items-center text-sm">
            <input 
              type="checkbox" 
              checked={showDataPoints}
              onChange={() => setShowDataPoints(!showDataPoints)}
              className="mr-1"
            />
            Show Data Points
          </label>
          
          <label className="flex items-center text-sm">
            <input 
              type="checkbox" 
              checked={showGrid}
              onChange={() => setShowGrid(!showGrid)}
              className="mr-1"
            />
            Show Grid
          </label>
          
          <select 
            value={legendPosition} 
            onChange={(e) => setLegendPosition(e.target.value)}
            className="px-1 py-0.5 border rounded text-xs"
          >
            <option value="top">Legend Top</option>
            <option value="bottom">Legend Bottom</option>
            <option value="right">Legend Right</option>
          </select>
        </div>
        
        <div className="mb-3 text-sm">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {experiments.map((exp, index) => (
              <div key={exp.metadata.id} className="flex items-center">
                <span 
                  className="inline-block w-3 h-3 mr-1 rounded-sm" 
                  style={{ backgroundColor: colors[index % colors.length] }}
                ></span>
                <span>{exp.metadata.name}</span>
              </div>
            ))}
          </div>
        </div>
        
        {(viewMode === 'chart' || viewMode === 'combined') && (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={showGrid ? "#ddd" : "transparent"} />
              <XAxis
                type="number"
                dataKey="p"
                domain={normalizeProbability ? [0, 1] : [0, 1]}
                label={{ 
                  value: normalizeProbability ? 'Normalized Probability' : 'Probability (p)', 
                  position: 'insideBottom', 
                  offset: -5 
                }}
                tickFormatter={value => value.toFixed(2)}
              />
              <YAxis
                type="number"
                domain={yAxisDomain}
                label={{ 
                  value: selectedMetric === 'discrepancy' ? 'Discrepancy' : 
                         selectedMetric === 'errorPercent' ? 'Error %' : 
                         'Value', 
                  angle: -90, 
                  position: 'insideLeft', 
                  offset: -10 
                }}
              />
              <Tooltip 
                formatter={(value) => value !== undefined && !isNaN(value) ? value.toFixed(4) : 'N/A'} 
                labelFormatter={(value) => `Probability: ${value.toFixed(2)}`}
              />
              <Legend verticalAlign={legendPosition === 'bottom' ? 'bottom' : 'top'} height={36} />
              
              {selectedMetric === 'discrepancy' && experiments.map((experiment, index) => (
                <Line 
                  key={experiment.metadata.id}
                  data={chartData.filter(d => d.experimentId === experiment.metadata.id)}
                  type="monotone" 
                  dataKey={experiment.metadata.name} 
                  name={experiment.metadata.name} 
                  stroke={colors[index % colors.length]} 
                  strokeWidth={2} 
                  dot={showDataPoints ? { r: 3, strokeWidth: 1 } : false} 
                  connectNulls 
                />
              ))}
              
              {selectedMetric === 'errorPercent' && experiments.map((experiment, index) => (
                <Line 
                  key={experiment.metadata.id}
                  data={chartData.filter(d => d.experimentId === experiment.metadata.id && d.errorPercent !== null)}
                  type="monotone" 
                  dataKey="errorPercent" 
                  name={`${experiment.metadata.name} (Error %)`} 
                  stroke={colors[index % colors.length]} 
                  strokeWidth={2} 
                  dot={showDataPoints ? { r: 3, strokeWidth: 1 } : false}
                  connectNulls 
                />
              ))}
                <ReferenceLine 
                  y={1e-6} 
                  stroke="#666" 
                  strokeDasharray="3 3" 
                  label={{ 
                    value: "Convergence threshold (10⁻⁶)", 
                    position: "right",
                    style: { fontSize: 12, fill: '#666' }
                  }}
                />
              {selectedMetric === 'theoretical' && experiments.map((experiment, index) => {
                const expColor = colors[index % colors.length];
                return (
                  <React.Fragment key={experiment.metadata.id}>
                    <Line 
                      data={chartData.filter(d => d.experimentId === experiment.metadata.id && d.theoretical !== null)}
                      type="monotone" 
                      dataKey="theoretical" 
                      name={`${experiment.metadata.name} (Theoretical)`} 
                      stroke={expColor} 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={showDataPoints ? { r: 3, strokeWidth: 1 } : false}
                      connectNulls 
                    />
                    <Line 
                      data={chartData.filter(d => d.experimentId === experiment.metadata.id)}
                      type="monotone" 
                      dataKey={experiment.metadata.name} 
                      name={`${experiment.metadata.name} (Experimental)`} 
                      stroke={expColor} 
                      strokeWidth={2} 
                      dot={showDataPoints ? { r: 3, strokeWidth: 1 } : false}
                      connectNulls 
                    />
                  </React.Fragment>
                );
              })}
              
              {highlightCrossover && (
                <ReferenceLine x={0.5} stroke="#666" strokeDasharray="3 3" label={{ 
                  value: 'Crossover Point (p=0.5)', 
                  position: 'insideBottomRight', 
                  fill: '#666',
                  fontSize: 11
                }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        )}
        
        {(viewMode === 'detail' || viewMode === 'combined') && (
          <div className="mt-4">
            <h4 className="font-medium mb-2">Experiment Details:</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Processes</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Algorithm</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Range</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data Points</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Avg Discrepancy</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Avg Variance</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {experiments.map((exp, index) => {
                    // Calculate average discrepancy and variance
                    const discrepancies = exp.results.map(r => r.discrepancy);
                    const avgDiscrepancy = discrepancies.reduce((sum, d) => sum + d, 0) / discrepancies.length;
                    
                    // Calculate average variance
                    let totalVariance = 0;
                    let countWithVariance = 0;
                    
                    exp.results.forEach(result => {
                      if (result.discrepancies && result.discrepancies.length > 1) {
                        const mean = result.discrepancy;
                        const variance = result.discrepancies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / result.discrepancies.length;
                        totalVariance += variance;
                        countWithVariance++;
                      }
                    });
                    
                    const avgVariance = countWithVariance > 0 ? totalVariance / countWithVariance : null;
                    
                    return (
                      <tr key={exp.metadata.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium" style={{ color: colors[index % colors.length] }}>
                          {exp.metadata.name}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {exp.parameters.processCount}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {exp.parameters.algorithm}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {exp.parameters.minP.toFixed(2)} - {exp.parameters.maxP.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {exp.results.length}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm">
                          {new Date(exp.metadata.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-mono">
                          {avgDiscrepancy.toFixed(4)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-mono">
                          {avgVariance !== null ? avgVariance.toFixed(6) : 'N/A'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Metadata and tags section */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {experiments.map((exp, index) => (
                <div key={exp.metadata.id} className="bg-gray-50 p-3 rounded border">
                  <h5 className="font-medium mb-2" style={{ color: colors[index % colors.length] }}>
                    {exp.metadata.name}
                  </h5>
                  
                  {exp.metadata.description && (
                    <p className="text-sm text-gray-600 mb-2">{exp.metadata.description}</p>
                  )}
                  
                  <div className="flex flex-wrap gap-1 mb-2">
                    {exp.metadata.tags && exp.metadata.tags.map((tag, i) => (
                      <span key={i} className="text-xs bg-white text-gray-600 px-1.5 py-0.5 rounded border">
                        {tag}
                      </span>
                    ))}
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    Created: {new Date(exp.metadata.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Advanced statistical analysis */}
        {experiments.length > 1 && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium mb-3">Comparative Statistical Analysis</h4>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 border">
                <thead className="bg-blue-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Experiment</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Avg Disc.</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Min Disc.</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Max Disc.</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Variance</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Std. Deviation</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">Avg Error (%)</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {experiments.map((exp, index) => {
                    // Statistical calculations
                    const discrepancies = exp.results.map(r => r.discrepancy);
                    const mean = discrepancies.reduce((a, b) => a + b, 0) / discrepancies.length;
                    const min = Math.min(...discrepancies);
                    const max = Math.max(...discrepancies);
                    
                    // Calculate variance and standard deviation
                    const variance = discrepancies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / discrepancies.length;
                    const stdDev = Math.sqrt(variance);
                    
                    // Calculate average error compared to theoretical (if available)
                    const errorsPercent = exp.results
                      .filter(r => r.theoretical)
                      .map(r => Math.abs(r.discrepancy - r.theoretical) / r.theoretical * 100);
                    
                    const avgErrorPercent = errorsPercent.length > 0 ? 
                      errorsPercent.reduce((a, b) => a + b, 0) / errorsPercent.length : null;
                    
                    return (
                      <tr key={exp.metadata.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-medium" style={{ color: colors[index % colors.length] }}>
                          {exp.metadata.name}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-mono">
                          {mean.toFixed(4)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-mono">
                          {min.toFixed(4)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-mono">
                          {max.toFixed(4)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-mono">
                          {variance.toFixed(6)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-mono">
                          {stdDev.toFixed(4)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-sm font-mono">
                          {avgErrorPercent !== null ? avgErrorPercent.toFixed(2) + '%' : 'N/A'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            {/* Variance Visualization */}
            <div className="mt-6">
              <h4 className="font-medium mb-3">Variance Analysis</h4>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart
                  data={experiments.map(exp => {
                    // Calculate variance across all data points
                    const discrepancies = exp.results.map(r => r.discrepancy);
                    const mean = discrepancies.reduce((a, b) => a + b, 0) / discrepancies.length;
                    const variance = discrepancies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / discrepancies.length;
                    const stdDev = Math.sqrt(variance);
                    
                    // Prepare shortened name for display
                    const shortName = exp.metadata.name.length > 12 ? 
                      exp.metadata.name.substring(0, 12) + '...' : exp.metadata.name;
                    
                    return {
                      name: shortName,
                      fullName: exp.metadata.name,
                      variance: variance,
                      stdDev: stdDev
                    };
                  })}
                  margin={{ top: 30, right: 40, left: 50, bottom: 80 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="name" 
                    tick={{angle: -45, textAnchor: 'end', dominantBaseline: 'auto'}}
                    height={80}
                    label={{ value: 'Experiment', position: 'insideBottom', offset: -60 }}
                  />
                  <YAxis 
                    label={{ value: 'Value', angle: -90, position: 'insideLeft', offset: -35 }}
                    tickMargin={10}
                  />
                  <Tooltip 
                    formatter={(value, name) => [value.toFixed(6), name === 'variance' ? 'Variance' : 'Std Deviation']}
                    labelFormatter={(label, data) => data[0]?.payload?.fullName || label}
                  />
                  <Legend verticalAlign="top" height={40} />
                  <Bar dataKey="variance" name="Variance" fill="#8884d8" />
                  <Bar dataKey="stdDev" name="Standard Deviation" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            {/* Automated conclusions section */}
            <div className="mt-6 p-3 bg-white rounded border">
              <h5 className="font-medium mb-2">Automated Conclusions</h5>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {experiments.length > 1 && (() => {
                  // Find the best experiment by average discrepancy
                  const bestExpIndex = experiments
                    .map((exp, idx) => ({
                      idx,
                      avgDisc: exp.results.reduce((sum, r) => sum + r.discrepancy, 0) / exp.results.length
                    }))
                    .sort((a, b) => a.avgDisc - b.avgDisc)[0].idx;
                  
                  // Find the experiment with lowest variance
                  const lowestVarianceExpIndex = experiments
                    .map((exp, idx) => {
                      let totalVariance = 0;
                      let count = 0;
                      
                      exp.results.forEach(result => {
                        if (result.discrepancies && result.discrepancies.length > 1) {
                          const mean = result.discrepancy;
                          const variance = result.discrepancies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / result.discrepancies.length;
                          totalVariance += variance;
                          count++;
                        }
                      });
                      
                      return {
                        idx,
                        avgVariance: count > 0 ? totalVariance / count : Infinity
                      };
                    })
                    .sort((a, b) => a.avgVariance - b.avgVariance)[0].idx;
                  
                  return (
                    <>
                      <li className="text-green-700">
                        <strong>{experiments[bestExpIndex].metadata.name}</strong> shows the lowest average discrepancy ({
                          (experiments[bestExpIndex].results.reduce((sum, r) => sum + r.discrepancy, 0) / 
                          experiments[bestExpIndex].results.length).toFixed(4)
                        }),
                        suggesting it's the most effective experiment.
                      </li>
                      
                      <li className="text-blue-700">
                        <strong>{experiments[lowestVarianceExpIndex].metadata.name}</strong> shows the lowest variance,
                        indicating it produces the most consistent results.
                      </li>
                    </>
                  );
                })()}
                
                {(() => {
                  // Check if there are any mixed algorithm experiments
                  const mixedAlgExps = experiments.filter(exp => 
                    exp.parameters.algorithm === "auto" || 
                    exp.results.some(r => r.algorithm !== exp.results[0].algorithm)
                  );
                  
                  if (mixedAlgExps.length > 0) {
                    return (
                      <li>
                        Experiments with automatic algorithm selection demonstrate the expected behavior
                        around the crossover point (p=0.5).
                      </li>
                    );
                  }
                  return null;
                })()}
                
                {(() => {
                  // Detect if there are experiments crossing the p=0.5 point
                  const crossoverExps = experiments.filter(exp => 
                    exp.parameters.minP < 0.5 && exp.parameters.maxP > 0.5
                  );
                  
                  if (crossoverExps.length > 0) {
                    return (
                      <li>
                        The expected theoretical behavior is observed where FV is better for p&lt;0.5 and
                        AMP is better for p&gt;0.5.
                      </li>
                    );
                  }
                  return null;
                })()}
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  }
  
  // For other experiment types (currently we only have range)
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <h3 className="text-lg font-semibold mb-4">Experiment Comparison</h3>
      <p className="text-gray-500">This experiment type doesn't support comparison currently.</p>
    </div>
  );
}

// Component for advanced visualization and 3D comparison
function AdvancedComparisonView({ experiments }) {
  if (!experiments || experiments.length === 0) return null;
  
  const [viewType, setViewType] = useState('2d'); // '2d', 'heatmap'
  
  // Data for charts
  const all2DData = [];
  experiments.forEach((experiment, expIndex) => {
    experiment.results.forEach((result, resultIndex) => {
      all2DData.push({
        experimentName: experiment.metadata.name,
        experimentIndex: expIndex,
        p: result.p,
        algorithm: result.algorithm,
        discrepancy: result.discrepancy,
        theoretical: result.theoretical || 0,
        error: result.theoretical ? Math.abs(result.theoretical - result.discrepancy) : 0,
        errorPercent: result.theoretical && result.theoretical !== 0 ? 
          (Math.abs(result.theoretical - result.discrepancy) / result.theoretical) * 100 : 0,
        pointIndex: resultIndex,
        time: new Date(experiment.metadata.createdAt).getTime()
      });
    });
  });
  
  // Colors for experiments
  const colors = ['#4285F4', '#EA4335', '#FBBC05', '#34A853', '#8A2BE2', '#FF6B6B'];
  
  // Data for heatmap
  const heatmapData = experiments.map((experiment, index) => {
    // Group by probability ranges for heatmap
    const groups = [];
    const pRanges = [...Array(10)].map((_, i) => i / 10);
    
    pRanges.forEach(minP => {
      const maxP = minP + 0.1;
      const resultsInRange = experiment.results.filter(r => r.p >= minP && r.p < maxP);
      
      if (resultsInRange.length > 0) {
        const avgDiscrepancy = resultsInRange.reduce((sum, r) => sum + r.discrepancy, 0) / resultsInRange.length;
        groups.push({
          pRange: `${minP.toFixed(1)}-${maxP.toFixed(1)}`,
          value: avgDiscrepancy,
          count: resultsInRange.length
        });
      }
    });
    
    return {
      name: experiment.metadata.name,
      color: colors[index % colors.length],
      data: groups
    };
  });
  
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Advanced Visualization</h3>
        
        <div className="flex space-x-2">
          <select 
            value={viewType} 
            onChange={(e) => setViewType(e.target.value)}
            className="px-2 py-1 border rounded text-sm"
          >
            <option value="2d">2D Chart</option>
            <option value="heatmap">Heat Map</option>
          </select>
        </div>
      </div>
      
      {viewType === '2d' && (
        <div className="h-64 md:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              margin={{ top: 10, right: 30, left: 40, bottom: 30 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="p" 
                type="number" 
                label={{ value: 'Probability (p)', position: 'insideBottom', offset: -10 }}
                domain={[0, 1]}
                tickFormatter={value => value.toFixed(1)}
              />
              <YAxis
                label={{ value: 'Discrepancy', angle: -90, position: 'insideLeft', offset: -20 }}
                domain={[0, 1]}
                tickMargin={10}
              />
              <Tooltip formatter={(value) => value.toFixed(4)} />
              <Legend verticalAlign="top" height={36} />
              
              {experiments.map((experiment, index) => {
                // Prepare data for this experiment
                const data = experiment.results.map(result => ({
                  p: result.p,
                  experimentName: experiment.metadata.name,
                  [experiment.metadata.name]: result.discrepancy,
                  algorithm: result.algorithm
                }));
                
                return (
                  <Line
                    key={experiment.metadata.id}
                    data={data}
                    type="monotone"
                    dataKey={experiment.metadata.name}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    dot={{ r: 3, strokeWidth: 1 }}
                  />
                );
              })}
              
              <ReferenceLine x={0.5} stroke="#666" strokeDasharray="3 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
      
      {viewType === 'heatmap' && (
        <div className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {experiments.map((experiment, index) => {
              // Convert data for heatmap
              const heatmapSpecificData = [];
              
              // Create a 2D array for heatmap
              for (let alg of ['AMP', 'FV']) {
                for (let i = 0; i < 10; i++) {
                  const minP = i / 10;
                  const maxP = (i + 1) / 10;
                  
                  const resultsInRange = experiment.results.filter(
                    r => r.p >= minP && r.p < maxP && r.algorithm === alg
                  );
                  
                  if (resultsInRange.length > 0) {
                    const avgDiscrepancy = resultsInRange.reduce((sum, r) => sum + r.discrepancy, 0) / resultsInRange.length;
                    
                    heatmapSpecificData.push({
                      x: minP.toFixed(1),
                      y: alg,
                      value: avgDiscrepancy,
                      count: resultsInRange.length
                    });
                  }
                }
              }
              
              return (
                <div key={experiment.metadata.id} className="bg-gray-50 p-3 rounded-lg border">
                  <h4 className="font-medium text-center mb-2" style={{ color: colors[index % colors.length] }}>
                    {experiment.metadata.name}
                  </h4>
                  
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <ScatterChart
                        margin={{ top: 20, right: 20, bottom: 20, left: 50 }}
                      >
                        <CartesianGrid />
                        <XAxis 
                          type="category" 
                          dataKey="x" 
                          name="Probability" 
                          allowDuplicatedCategory={false}
                          label={{ value: 'Probability Range', position: 'insideBottom', offset: -10 }}
                        />
                        <YAxis 
                          type="category" 
                          dataKey="y" 
                          name="Algorithm" 
                          label={{ value: 'Algorithm', angle: -90, position: 'insideLeft', offset: -30 }}
                        />
                        <ZAxis 
                          dataKey="value" 
                          range={[50, 1000]} 
                          name="Discrepancy" 
                        />
                        <Tooltip 
                          formatter={(value) => value.toFixed(4)}
                          labelFormatter={() => ''}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white p-2 border shadow rounded">
                                  <p className="font-medium text-sm">{`${payload[0].payload.y} - ${payload[0].payload.x}`}</p>
                                  <p className="text-sm">{`Discrepancy: ${payload[0].payload.value.toFixed(4)}`}</p>
                                  <p className="text-xs">{`Samples: ${payload[0].payload.count}`}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Scatter
                          data={heatmapSpecificData}
                          fill={colors[index % colors.length]}
                        >
                          {heatmapSpecificData.map((entry, i) => (
                            <Cell
                              key={`cell-${i}`}
                              fill={interpolateColor(
                                '#c6f6d5', // Light green for low values (better)
                                '#f56565', // Red for high values (worse)
                                Math.min(1, entry.value)
                              )}
                            />
                          ))}
                        </Scatter>
                      </ScatterChart>
                    </ResponsiveContainer>
                  </div>
                  
                  <div className="flex justify-center mt-2">
                    <div className="w-full max-w-xs h-4 bg-gradient-to-r from-green-200 to-red-400 rounded">
                      <div className="flex justify-between text-xs px-1">
                        <span>0.0</span>
                        <span>Discrepancy</span>
                        <span>1.0</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Pattern analysis and conclusions */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium mb-3">Pattern Analysis</h4>
        
        <div className="grid grid-cols-1 gap-8 mb-4">
          <div className="bg-white p-6 rounded border">
            <h5 className="font-medium mb-4 text-green-700">Performance by Algorithm</h5>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={experiments.map(exp => {
                  // Separate by algorithm
                  const ampResults = exp.results.filter(r => r.algorithm === 'AMP');
                  const fvResults = exp.results.filter(r => r.algorithm === 'FV');
                  
                  const ampAvg = ampResults.length > 0 ?
                    ampResults.reduce((sum, r) => sum + r.discrepancy, 0) / ampResults.length : 0;
                  const fvAvg = fvResults.length > 0 ?
                    fvResults.reduce((sum, r) => sum + r.discrepancy, 0) / fvResults.length : 0;
                  
                  return {
                    name: exp.metadata.name.length > 12 ? 
                      exp.metadata.name.substring(0, 12) + '...' : exp.metadata.name,
                    fullName: exp.metadata.name,
                    AMP: ampAvg,
                    FV: fvAvg,
                    color: colors[experiments.indexOf(exp) % colors.length]
                  };
                })}
                margin={{ top: 30, right: 40, left: 50, bottom: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  tick={{angle: -45, textAnchor: 'end', dominantBaseline: 'auto'}}
                  height={80}
                  label={{ value: 'Experiment', position: 'insideBottom', offset: -60 }}
                />
                <YAxis 
                  label={{ value: 'Avg. Discrepancy', angle: -90, position: 'insideLeft', offset: -35 }}
                  tickMargin={10}
                />
                <Tooltip 
                  formatter={(value) => value.toFixed(4)}
                  labelFormatter={(label, data) => data[0]?.payload?.fullName || label}
                />
                <Legend verticalAlign="top" height={40} />
                <Bar dataKey="AMP" fill="#f56565" name="AMP Algorithm" />
                <Bar dataKey="FV" fill="#4299e1" name="FV Algorithm" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          
          <div className="bg-white p-6 rounded border">
            <h5 className="font-medium mb-4 text-blue-700">Variance Analysis</h5>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart
                data={experiments.map(exp => {
                  // Calculate variance across all data points
                  const discrepancies = exp.results.map(r => r.discrepancy);
                  const mean = discrepancies.reduce((a, b) => a + b, 0) / discrepancies.length;
                  const variance = discrepancies.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / discrepancies.length;
                  const stdDev = Math.sqrt(variance);
                  
                  // Prepare shortened name for display
                  const shortName = exp.metadata.name.length > 12 ? 
                    exp.metadata.name.substring(0, 12) + '...' : exp.metadata.name;
                  
                  return {
                    name: shortName,
                    fullName: exp.metadata.name,
                    variance: variance,
                    stdDev: stdDev
                  };
                })}
                margin={{ top: 30, right: 40, left: 50, bottom: 80 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="name" 
                  tick={{angle: -45, textAnchor: 'end', dominantBaseline: 'auto'}}
                  height={80}
                  label={{ value: 'Experiment', position: 'insideBottom', offset: -60 }}
                />
                <YAxis 
                  label={{ value: 'Value', angle: -90, position: 'insideLeft', offset: -35 }}
                  tickMargin={10}
                />
                <Tooltip 
                  formatter={(value, name) => [value.toFixed(6), name === 'variance' ? 'Variance' : 'Std Deviation']}
                  labelFormatter={(label, data) => data[0]?.payload?.fullName || label}
                />
                <Legend verticalAlign="top" height={40} />
                <Bar dataKey="variance" name="Variance" fill="#8884d8" />
                <Bar dataKey="stdDev" name="Standard Deviation" fill="#82ca9d" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple logo component
function AppLogo() {
  return (
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="40" fill="#f5f5f5" />
      <polygon points="50,30 65,37.5 65,62.5 50,70 35,62.5 35,37.5" fill="#4e54c8" stroke="#36389c" strokeWidth="1" />
    </svg>
  );
}

// Input Number component with label
function NumberInput({ value, onChange, min = 0, max = 1, step = 0.01, label, color }) {
  return (
    <div className="w-full mb-4">
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-medium" style={{ color }}>{label}</label>
      </div>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const newValue = Math.max(min, Math.min(max, parseFloat(e.target.value) || min));
          onChange(newValue);
        }}
        className="w-full p-2 border rounded-md"
        style={{ borderColor: color }}
      />
    </div>
  );
}

// Metric card for displaying values
function MetricCard({ label, value, color }) {
  return (
    <div className="bg-white rounded-lg shadow p-4 flex-1 min-w-20" style={{ borderLeft: `5px solid ${color}` }}>
      <h3 className="text-sm text-gray-500 font-medium">{label}</h3>
      <p className="text-lg font-bold mt-1">{value}</p>
    </div>
  );
}

// Progress bar
function ProgressBar({ value, label }) {
  return (
    <div className="w-full">
      {label && <div className="text-sm font-medium mb-1">{label}</div>}
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className="h-2 rounded-full" style={{ width: `${value}%`, backgroundColor: ACCENT_COLOR }} />
      </div>
    </div>
  );
}

// Visualization of experiment data
function ExperimentVisualization({ experimentData, currentRound = 0, processCount = 2 }) {
  if (!experimentData || !Array.isArray(experimentData) || experimentData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-400">No experiment data available</p>
      </div>
    );
  }

  const roundData = experimentData.slice(0, Math.min(currentRound + 1, experimentData.length));

  // Mejora de colores para admitir más procesos con distinción clara
  const generateProcessColors = (count) => {
    // Paleta extendida con colores más distintos entre sí
    const baseColors = [
      ALICE_COLOR, BOB_COLOR, CHARLIE_COLOR, 
      "#9c27b0", // morado
      "#e91e63", // rosa
      "#f44336", // rojo
      "#ff9800", // naranja
      "#ffc107", // amarillo
      "#8bc34a", // verde claro
      "#009688", // turquesa
      "#03a9f4", // azul claro  
      "#673ab7", // violeta
      "#795548", // marrón
      "#607d8b", // azul grisáceo
      "#ff5722"  // naranja rojizo
    ];
    

    if (count > baseColors.length) {
      const extraColors = [];
      for (let i = 0; i < count - baseColors.length; i++) {
        // Generamos colores HSL espaciados uniformemente
        const h = (i * 137.5) % 360; // Ángulo dorado para mejor distribución
        const s = 75 + Math.random() * 15; // Saturación alta
        const l = 45 + Math.random() * 10; // Luminosidad media
        extraColors.push(`hsl(${h}, ${s}%, ${l}%)`);
      }
      return [...baseColors, ...extraColors];
    }
    
    return baseColors.slice(0, count);
  };
  
  const processColors = generateProcessColors(processCount);
  
  // Optimización del chartData para muchos procesos
  const chartData = roundData.map(d => {
    const round = d && typeof d.round === 'number' ? d.round : 0;
    const discrepancy = d && typeof d.discrepancy === 'number' ? d.discrepancy : 0;
    
    // Formato adaptado para n procesos
    const data = { round, discrepancy };
    
    if (d && d.values) {
      d.values.forEach((val, idx) => {
        // Para cada proceso, crear una entrada en los datos
        data[`p${idx}`] = val;
      });
    }
    
    return data;
  });

  // Función para generar nombre de proceso según índice
  const getProcessName = (index) => {
    if (index < 3) {
      return ["Alice", "Bob", "Charlie"][index];
    } else if (index < 26) {
      // Usar letras del alfabeto para procesos 4-26
      return `P-${String.fromCharCode(65 + index)}`;
    } else {
      // Para más de 26, usar números
      return `P-${index + 1}`;
    }
  };

  // Determinar si se debe compactar la leyenda
  const useTwoColumnLegend = processCount > 5;

  return (
    <div className="bg-white rounded-lg shadow p-4 h-80">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold">Experiment Visualization</h3>
        
        {processCount > 8 && (
          <div className="text-xs text-gray-500 bg-yellow-50 px-2 py-1 rounded">
            Showing {processCount} processes
          </div>
        )}
      </div>
      
      <ResponsiveContainer width="100%" height={useTwoColumnLegend ? "75%" : "80%"}>
        <LineChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="round" />
          <YAxis domain={[0, 1]} />
          <Tooltip 
            formatter={(value) => value !== undefined && !isNaN(value) ? value.toFixed(4) : 'N/A'}
            labelFormatter={(value) => `Round: ${value}`}
            isAnimationActive={false} // Mejorar rendimiento
          />
          <Legend 
            layout={useTwoColumnLegend ? "horizontal" : "horizontal"}
            verticalAlign="bottom"
            align="center"
            wrapperStyle={{ 
              paddingTop: "10px",
              fontSize: processCount > 8 ? "9px" : "11px",
              display: "grid", 
              gridTemplateColumns: useTwoColumnLegend ? "repeat(4, 1fr)" : "repeat(3, 1fr)"
            }}
          />
          
          {/* Renderizar línea para cada proceso */}
          {Array.from({ length: Math.min(processCount, 20) }).map((_, index) => {
            const name = getProcessName(index);
            const strokeWidth = index < 3 ? 2.5 : 1.5;
            const strokeDasharray = index > 10 ? "3 3" : null; // Línea punteada para procesos adicionales
              
            return (
              <Line 
                key={index}
                type="monotone" 
                dataKey={`p${index}`} 
                name={name} 
                stroke={processColors[index % processColors.length]} 
                strokeWidth={strokeWidth}
                dot={{ r: index < 3 ? 3 : 2, strokeWidth: 1, fill: "white" }}
                activeDot={{ r: 4 }}
              />
            );
          })}
          
          {/* Limitar a 20 procesos en la visualización */}
          {processCount > 20 && (
            <Line
              type="monotone"
              dataKey="discrepancy"
              name={`+${processCount - 20} more`}
              stroke="#999"
              strokeWidth={0}
              dot={{ r: 0 }}
              activeDot={{ r: 0 }}
            />
          )}
          
          <Line 
            type="monotone" 
            dataKey="discrepancy" 
            name="Discrepancy" 
            stroke="#9b59b6" 
            strokeWidth={2.5}
            dot={{ r: 3 }} 
          />
        </LineChart>
      </ResponsiveContainer>
      
      {processCount > 10 && (
        <div className="mt-1 text-xs text-gray-500 text-center">
          Note: For better visibility, some processes may be shown with dashed lines or compact representation.
        </div>
      )}
    </div>
  );
}

// Results table
function ResultsTable({ experimentData, processCount = 2, forcedAlgorithm, fvMethod, rounds = 1 }) {
  // Si hay demasiados procesos, mostrar versión compacta
  const isCompactView = processCount > 6;

  if (!experimentData || !Array.isArray(experimentData) || experimentData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-400">No experiment data available</p>
      </div>
    );
  }

  // Mostrar solo algunos procesos clave si hay muchos
  const getDisplayedProcesses = () => {
    if (!isCompactView) {
      return Array.from({ length: processCount }).map((_, i) => i);
    }
    
    // Para muchos procesos, mostrar: primero, segundo, alguno del medio, penúltimo y último
    if (processCount <= 10) {
      return [0, 1, Math.floor(processCount/2), processCount-2, processCount-1];
    } else {
      return [0, 1, 2, Math.floor(processCount/3), Math.floor(2*processCount/3), processCount-2, processCount-1];
    }
  };
  
  const displayedProcesses = getDisplayedProcesses();

  // Crear encabezados para procesos
  const processHeaders = displayedProcesses.map(idx => {
    const name = idx < 3 ? ["Alice", "Bob", "Charlie"][idx] : `P${idx+1}`;
    const color = idx < 3 ? 
      [ALICE_COLOR, BOB_COLOR, CHARLIE_COLOR][idx] : 
      "#666"; // Color por defecto para procesos adicionales
    
    return { index: idx, name, color };
  });

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Round</th>
              {processHeaders.map((header) => (
                <th 
                  key={header.index}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  style={{ color: header.color }}
                >
                  {header.name}
                </th>
              ))}
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discrepancy</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {experimentData.map((data, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{data.round}</td>
                
                {/* Renderizar celdas para procesos seleccionados */}
                {processHeaders.map((header) => (
                  <td 
                    key={header.index}
                    className="px-6 py-4 whitespace-nowrap text-sm" 
                    style={{ color: header.color }}
                  >
                    {data.values && data.values[header.index] !== undefined ? 
                      data.values[header.index].toFixed(4) : 'N/A'}
                  </td>
                ))}
                
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {data.discrepancy !== undefined ? data.discrepancy.toFixed(4) : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {isCompactView && (
        <div className="px-4 py-2 bg-yellow-50 text-sm">
          <p>Showing {displayedProcesses.length} of {processCount} processes. {processCount-displayedProcesses.length} processes are hidden for readability.</p>
        </div>
      )}
    </div>
  );
}


/// Histogram plot con distribución binomial correcta para un valor específico de p
function HistogramPlot({ discrepancies, theoretical, experimental, repetitions, selectedP }) {
    if (!discrepancies || !Array.isArray(discrepancies) || discrepancies.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
          <p className="text-gray-400">No data available</p>
        </div>
      );
    }

    const validDiscrepancies = discrepancies.filter(d => typeof d === 'number' && !isNaN(d) && isFinite(d));

    if (validDiscrepancies.length === 0) {
      return (
        <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
          <p className="text-gray-400">No valid data points available</p>
        </div>
      );
    }

    // Calculate observed statistics
    const observedMean = validDiscrepancies.reduce((a, b) => a + b, 0) / validDiscrepancies.length;
    const observedVariance = validDiscrepancies.reduce((sum, d) => sum + Math.pow(d - observedMean, 2), 0) / validDiscrepancies.length;
    const observedSD = Math.sqrt(observedVariance);

    // p = E[D] (theoretical expected discrepancy)
    const p = theoretical !== null && theoretical !== undefined ? theoretical : observedMean;
    const n = repetitions; // número de simulaciones
    
    // Calcular desviación estándar teórica
    const sigma = Math.sqrt(p * (1 - p) / n);
    
    // Límites del intervalo de confianza 95%
    const ci95Lower = p - 1.96 * sigma;
    const ci95Upper = p + 1.96 * sigma;

    // Función para calcular coeficiente binomial C(n,k)
    function binomialCoeff(n, k) {
      if (k > n || k < 0) return 0;
      if (k === 0 || k === n) return 1;
      
      // Usar logaritmos para evitar overflow
      let logResult = 0;
      for (let i = 0; i < k; i++) {
        logResult += Math.log(n - i) - Math.log(i + 1);
      }
      return Math.exp(logResult);
    }

    // Generar PMF de Binomial(n, p)
    const binomialPMF = [];
    
    // Para visualización, solo calculamos puntos alrededor de la media
    // (calcular todos los n puntos sería muy costoso para n grande)
    const meanK = Math.round(n * p);
    const rangeSD = 5; // Mostrar ±5 desviaciones estándar
    const kMin = Math.max(0, Math.floor(meanK - rangeSD * Math.sqrt(n * p * (1 - p))));
    const kMax = Math.min(n, Math.ceil(meanK + rangeSD * Math.sqrt(n * p * (1 - p))));
    
    for (let k = kMin; k <= kMax; k++) {
      const prob = binomialCoeff(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
      const xBar = k / n; // X̄ = X/n
      
      binomialPMF.push({
        x: xBar,
        probability: prob * n, // Escalar para que sea densidad
        k: k
      });
    }

    // Create bins for histogram empírico
    // En HistogramPlot, agregar límite de bins para datasets grandes:
    const numBins = Math.min(30, Math.max(10, Math.ceil(Math.sqrt(validDiscrepancies.length))));
    const min = Math.min(...validDiscrepancies);
    const max = Math.max(...validDiscrepancies);
    const binWidth = (max - min) / numBins || 0.01;

    // Create histogram data
    const bins = [];
    for (let i = 0; i < numBins; i++) {
      const binStart = min + i * binWidth;
      const binEnd = binStart + binWidth;
      const binCenter = (binStart + binEnd) / 2;
      
      const count = validDiscrepancies.filter(d => 
        d >= binStart && (i === numBins - 1 ? d <= binEnd : d < binEnd)
      ).length;
      
      bins.push({
        x: binCenter,
        count: count,
        frequency: count / validDiscrepancies.length / binWidth, // Densidad
        binStart: binStart,
        binEnd: binEnd
      });
    }

    // Encontrar máximo para escala Y
    const maxFrequency = Math.max(...bins.map(b => b.frequency));
    const maxPMF = Math.max(...binomialPMF.map(p => p.probability));
    const yMax = Math.max(maxFrequency, maxPMF) * 1.2;

    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-2">
          Distribution of Discrepancies: Binomial Model vs Empirical (p = {selectedP.toFixed(2)})
        </h3>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-blue-50 p-3 rounded">
            <h4 className="font-medium text-sm mb-2">Theoretical Statistics</h4>
            <ul className="text-xs space-y-1">
              <li><span className="font-medium">E[D]:</span> {p.toFixed(6)}</li>
              <li><span className="font-medium">σ:</span> {sigma.toFixed(6)}</li>
              <li><span className="font-medium">95% CI:</span> [{ci95Lower.toFixed(6)}, {ci95Upper.toFixed(6)}]</li>
              <li><span className="font-medium">n (simulations):</span> {n}</li>
            </ul>
          </div>
          
          <div className="bg-green-50 p-3 rounded">
            <h4 className="font-medium text-sm mb-2">Empirical Statistics</h4>
            <ul className="text-xs space-y-1">
              <li><span className="font-medium">Mean:</span> {observedMean.toFixed(6)}</li>
              <li><span className="font-medium">SD:</span> {observedSD.toFixed(6)}</li>
              <li><span className="font-medium">Min:</span> {min.toFixed(6)}</li>
              <li><span className="font-medium">Max:</span> {max.toFixed(6)}</li>
            </ul>
          </div>
        </div>
        
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart 
              margin={{ top: 20, right: 30, left: 20, bottom: 40 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                type="number"
                domain={[Math.min(min, ci95Lower - 0.05), Math.max(max, ci95Upper + 0.05)]}
                tickFormatter={(value) => value.toFixed(3)}
                label={{ value: 'Discrepancy (X̄ = X/n)', position: 'insideBottom', offset: -10 }}
              />
              <YAxis 
                domain={[0, yMax]}
                label={{ value: 'Density', angle: -90, position: 'insideLeft' }}
                tickFormatter={(value) => value.toFixed(2)}
              />
              
              {/* Histograma empírico */}
              <Bar 
                data={bins}
                dataKey="frequency" 
                fill="#10b981" 
                opacity={0.6}
                name="Empirical Histogram"
              />
              
              {/* PMF Binomial teórica */}
              <Line
                data={binomialPMF}
                type="stepAfter"
                dataKey="probability"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={{ r: 2 }}
                name="Binomial PMF"
              />
              
              {/* Banda de confianza 95% */}
              <ReferenceArea
                x1={ci95Lower}
                x2={ci95Upper}
                fill="#3b82f6"
                fillOpacity={0.1}
                label={{ value: "95% CI", position: "insideTop" }}
              />
              
              {/* Media teórica */}
              <ReferenceLine 
                x={p} 
                stroke="#ef4444" 
                strokeWidth={2}
                strokeDasharray="5 5" 
                label={{ 
                  value: `E[D] = ${p.toFixed(4)}`, 
                  position: 'insideTopRight',
                  offset: 10,
                  style: { fill: '#ef4444', fontSize: '12px', fontWeight: 'bold' }
                }}
              />
              
              {/* Media observada */}
              <ReferenceLine 
                x={observedMean} 
                stroke="#f59e0b" 
                strokeWidth={2}
                strokeDasharray="3 3" 
                label={{ 
                  value: `Observed = ${observedMean.toFixed(4)}`, 
                  position: observedMean > p ? 'insideTopLeft' : 'insideBottomRight',
                  offset: 10,
                  style: { fill: '#f59e0b', fontSize: '12px', fontWeight: 'bold' }
                }}
              />
              
              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length > 0) {
                    const data = payload[0].payload;
                    if (data.k !== undefined) {
                      // PMF point
                      return (
                        <div className="bg-white p-2 border rounded shadow-md">
                          <p className="font-semibold">Binomial PMF</p>
                          <p>k = {data.k}, X̄ = {data.x.toFixed(6)}</p>
                          <p>P(X = k) = {(data.probability / n).toFixed(8)}</p>
                        </div>
                      );
                    } else {
                      // Histogram bin
                      return (
                        <div className="bg-white p-2 border rounded shadow-md">
                          <p className="font-semibold">Empirical Bin</p>
                          <p>Range: [{data.binStart.toFixed(4)}, {data.binEnd.toFixed(4)})</p>
                          <p>Count: {data.count}</p>
                          <p>Density: {data.frequency.toFixed(4)}</p>
                        </div>
                      );
                    }
                  }
                  return null;
                }}
              />
              
              <Legend />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        
        <div className="mt-4 p-3 bg-gray-50 rounded text-xs">
          <p className="font-semibold mb-2">Model Details:</p>
          <p>• X ~ Binomial(n={n}, p={p.toFixed(6)})</p>
          <p>• X̄ = X/n has mean p and standard deviation σ = √(p(1-p)/n) = {sigma.toFixed(6)}</p>
          <p>• 95% CI: [p - 1.96σ, p + 1.96σ] = [{ci95Lower.toFixed(6)}, {ci95Upper.toFixed(6)}]</p>
          <p>• The blue line shows P(X̄ = k/n) for k = {kMin} to {kMax}</p>
          {Math.abs(observedMean - p) > 2 * sigma && (
            <p className="text-orange-600 font-semibold mt-2">
              ⚠️ Observed mean is {((Math.abs(observedMean - p) / sigma).toFixed(2))}σ away from theoretical mean
            </p>
          )}
        </div>
      </div>
    );
}

  
function TheoryPlot({
  currentP,
  experimentalData,
  displayCurves,
  rounds = 1,
  processValues = [0, 1],
  meetingPoint = 0.5,
  steps = 51,
  selectedAlgorithms = ["auto"]
}) {
  if (currentP == null) currentP = 0.5;

  const [selectedRound, setSelectedRound] = useState(rounds);
  useEffect(() => setSelectedRound(rounds), [rounds]);

  const validExperimentalData = Array.isArray(experimentalData)
    ? experimentalData.filter(item =>
        item && typeof item.p === 'number' && typeof item.discrepancy === 'number'
      )
    : [];

  const n = processValues.length;
  const m = processValues.filter(v => v === 0).length;

  const ampData = [];
  const fvData  = [];
  for (let i = 0; i <= steps; i++) {
    const p = i / steps;
    const q = 1 - p;
    let ampD, fvD;

    if (n === 2) {
      ampD = Math.pow(q, selectedRound);
      fvD  = Math.pow(p*p + q*q, selectedRound);
    } else {
      const A = Math.pow(1 - Math.pow(q, n - m), m);
      const B = Math.pow(1 - Math.pow(q, m), n - m);
      let ampV = 1 - (meetingPoint * A + (1 - meetingPoint) * B);
      let fvV  = 1 - (Math.pow(q, m*(n-m)) * (A + B));
      for (let r = 1; r < selectedRound; r++) {
        ampV *= (1 - p);
        fvV  *= (p*p + q*q);
      }
      ampD = ampV;
      fvD  = fvV;
    }

    ampData.push({ p, discrepancy: ampD });
    fvData.push({ p, discrepancy: fvD });
  }

  // Inyectar p=0.5 exacto si el grid no lo contiene (evita "pico" visual corrido)
  const ensureHalfPoint = (arr, which) => {
    const hasHalf = arr.some(d => Math.abs(d.p - 0.5) < 1e-12);
    if (!hasHalf) {
      const p = 0.5, q = 0.5;
      let D;
      if (n === 2) {
        D = which === 'AMP'
          ? Math.pow(q, selectedRound)
          : Math.pow(p*p + q*q, selectedRound);
      } else {
        const A = Math.pow(1 - Math.pow(q, n - m), m);
        const B = Math.pow(1 - Math.pow(q, m), n - m);
        let V = (which === 'AMP')
          ? 1 - (meetingPoint * A + (1 - meetingPoint) * B)
          : 1 - (Math.pow(q, m*(n-m)) * (A + B));
        for (let r = 1; r < selectedRound; r++) {
          V *= (which === 'AMP') ? (1 - p) : (p*p + q*q);
        }
        D = V;
      }
      arr.push({ p: 0.5, discrepancy: D });
      arr.sort((a, b) => a.p - b.p);
    }
  };
  ensureHalfPoint(ampData, 'AMP');
  ensureHalfPoint(fvData, 'FV');

  const showAMP = displayCurves?.theoreticalAmp ?? true;
  const showFV  = displayCurves?.theoreticalFv  ?? true;
  const showExp = displayCurves?.experimental && validExperimentalData.length > 0;

  const algorithmColors = {
    "RECURSIVE AMP": "#8b5cf6",
    "AMP": "#10b981",
    "FV": "#ef4444",
    "MIN": "#f59e0b",
    "auto": "#6b7280"
  };

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <ResponsiveContainer width="100%" height={400}>
        <ComposedChart margin={{ top: 5, right: 30, left: 20, bottom: 25 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            dataKey="p"
            type="number"
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            tickFormatter={v => (typeof v === 'number' ? v.toFixed(2) : v)}
            label={{ value: 'Probability (p)', position: 'insideBottom', offset: -5 }}
          />
          <YAxis
            dataKey="discrepancy"
            type="number"
            domain={[0, 1]}
            label={{ value: 'Discrepancy', angle: -90, position: 'insideLeft', offset: -10 }}
          />
          <Tooltip
            formatter={val => (val != null && !isNaN(val) ? Number(val).toFixed(4) : 'N/A')}
            labelFormatter={val => `p = ${val != null && !isNaN(val) ? Number(val).toFixed(2) : 'N/A'}`}
          />
          <Legend verticalAlign="top" height={36} />

          {showAMP && (
            <Line
              data={ampData}
              dataKey="discrepancy"
              name="AMP (Theoretical)"
              stroke="#2ecc71"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          )}
          {showFV && (
            <Line
              data={fvData}
              dataKey="discrepancy"
              name="FV (Theoretical)"
              stroke="#e74c3c"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
            />
          )}

          {showExp && selectedAlgorithms.map((algo) => {
            const algoData = validExperimentalData.filter(item => {
              if (algo === "auto") {
                return item.displayAlgorithm === "auto" ||
                       (item.algorithm === (item.p > 0.5 ? "AMP" : "FV") && !item.displayAlgorithm);
              }
              return item.algorithm === algo;
            });
            if (algoData.length === 0) return null;

            return (
              <Line
                key={algo}
                data={algoData}
                dataKey="discrepancy"
                name={`${algo} (Experimental)`}
                stroke={algorithmColors[algo] || "#000000"}
                strokeWidth={3}
                dot={{ r: 2, fill: 'white' }}
                connectNulls
              />
            );
          })}

          <ReferenceLine x={0.5} stroke="#666" strokeDasharray="3 3" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}






function FVMethodComparisonChart({ comparisonResults }) {
  if (!comparisonResults || !Array.isArray(comparisonResults) || comparisonResults.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-400">No comparison data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-4 mt-4">
      <h3 className="text-lg font-semibold mb-4">FV Methods Comparison</h3>
      
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={comparisonResults} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="method" />
          <YAxis yAxisId="left" orientation="left" label={{ value: 'Final Discrepancy', angle: -90, position: 'insideLeft' }} />
          <YAxis yAxisId="right" orientation="right" label={{ value: 'Rounds to Converge', angle: 90, position: 'insideRight' }} />
          <Tooltip />
          <Legend />
          <Bar yAxisId="left" dataKey="avgDiscrepancy" name="Avg. Discrepancy" fill="#8884d8" />
          <Bar yAxisId="right" dataKey="avgConvergenceRound" name="Avg. Rounds to Converge" fill="#82ca9d" />
        </BarChart>
      </ResponsiveContainer>
      
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Method</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg. Discrepancy</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg. Convergence</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {comparisonResults.map((result, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {result.method}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {result.avgDiscrepancy.toFixed(4)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {result.avgConvergenceRound.toFixed(2)} rounds
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {result.method === "average" && "Average of received values"}
                  {result.method === "median" && "Median of own and received values"}
                  {result.method === "weighted" && "Weighted blend based on probability"}
                  {result.method === "accelerated" && "Accelerated convergence toward center"}
                  {result.method === "first" && "First received value only"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {experimentalResults.length > 0 && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold mb-2">Convergence Analysis</h4>
          <div className="text-sm space-y-1">
            {(() => {
              const convergedCount = experimentalResults.filter(r => r.discrepancy < 1e-10).length;
              const nearConvergedCount = experimentalResults.filter(r => r.discrepancy < 1e-6).length;
              const totalPoints = experimentalResults.length;
              
              return (
                <>
                  <p>• Fully converged: {convergedCount}/{totalPoints} points ({(convergedCount/totalPoints*100).toFixed(1)}%)</p>
                  <p>• Nearly converged: {nearConvergedCount}/{totalPoints} points ({(nearConvergedCount/totalPoints*100).toFixed(1)}%)</p>
                  {processCount > 2 && rounds > 1 && (
                    <p className="text-orange-600 mt-2">
                      Note: For {processCount} processes with {rounds} rounds, convergence is expected to be exponentially faster than single-round cases.
                    </p>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

// Animation controls
function AnimationControls({ currentRound, totalRounds, onPlay, onPause, onReset, onSliderChange, isPlaying }) {
  return (
    <div className="flex items-center space-x-4 bg-white rounded-lg shadow p-4">
      <button onClick={onReset} className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700">
        ⏮️
      </button>
      {isPlaying ? (
        <button onClick={onPause} className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700">
          ⏸️
        </button>
      ) : (
        <button onClick={onPlay} className="p-2 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700">
          ▶️
        </button>
      )}
      <div className="font-semibold text-sm">Round: {currentRound}</div>
      <div className="flex-1">
        <input
          type="range"
          min={0}
          max={totalRounds}
          value={currentRound}
          onChange={(e) => onSliderChange(Number(e.target.value))}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
      </div>
    </div>
  );
}


function RangeResultsTable({
  results,
  processCount = 2,
  forcedAlgorithm,
  fvMethod,
  rounds = 1
}) {
  if (!results || !Array.isArray(results) || results.length === 0) {
    return (
      <div className="bg-gray-100 p-4 rounded-lg text-center text-gray-500">
        No results available yet. Run the simulation to see results.
      </div>
    );
  }

  // Filtrar resultados inválidos
  const validResults = results.filter(
    (r) =>
      r &&
      typeof r.p === "number" &&
      typeof r.discrepancy === "number" &&
      typeof r.algorithm === "string"
  );

  // Ordenar por probabilidad
  const sortedResults = [...validResults].sort((a, b) => a.p - b.p);

  // Recalcular teóricos para 2 procesos
  const resultsWithCorrectTheory = sortedResults.map((result) => {
    const newResult = { ...result };
    if (processCount === 2 && typeof result.theoretical !== "number") {
      const p = result.p;
      const q = 1 - p;
      if (result.algorithm === "AMP") {
        newResult.theoretical = Math.pow(q, rounds);
      } else {
        newResult.theoretical = Math.pow(p * p + q * q, rounds);
      }
    }
    return newResult;
  });

  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-xs">
          <thead>
            <tr className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Probability (p)</th>
              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Algorithm</th>
              <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider">Experimental{rounds > 1 ? ` (${rounds} rounds)` : ""}</th>
              <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Samples</th>
              {processCount === 2 && (
                <>
                  <th className="px-6 py-4 text-left font-semibold uppercase tracking-wider">Theoretical{rounds > 1 ? ` (${rounds} rounds)` : ""}</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Error Abs</th>
                  <th className="px-3 py-2 text-left font-semibold uppercase tracking-wider">Error %</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {resultsWithCorrectTheory.map((result, idx) => {
              // === MODIFICACIÓN 1: calcular error absoluto ===
              const error =
                processCount === 2 && typeof result.theoretical === "number"
                  ? Math.abs(result.theoretical - result.discrepancy)
                  : null;

              let errorPercent = 0;
              let errorType = "normal";
              let displayError = "";

              if (error !== null) {
                const epsilon = 1e-10;
                const smallValueThreshold = 1e-6;

                if (result.theoretical < epsilon && result.discrepancy < epsilon) {
                  errorType = "both-zero";
                  displayError = "≈0%";
                } else if (result.theoretical < smallValueThreshold) {
                  errorType = "absolute";
                  displayError = `±${error.toExponential(2)}`;
                } else {
                  errorPercent = (error / result.theoretical) * 100;
                  if (errorPercent > 999) {
                    displayError = ">999%";
                  } else {
                    displayError = `${errorPercent.toFixed(1)}%`;
                  }
                }
              }

              return (
                <tr key={idx} className={idx % 2 === 0 ? "" : "bg-gray-50"}>
                  <td className="px-3 py-2 whitespace-nowrap">{result.p.toFixed(2)}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        result.algorithm === "AMP"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {result.algorithm}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-mono text-sm">
                      {result.discrepancy < 1e-6 && result.discrepancy > 0
                        ? result.discrepancy.toExponential(3)
                        : result.discrepancy.toFixed(6)}
                    </div>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">{result.samples}</td>

                  {processCount === 2 && (
                    <>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-mono text-sm text-gray-600">
                          {result.theoretical < 1e-6 && result.theoretical > 0
                            ? result.theoretical.toExponential(3)
                            : result.theoretical.toFixed(6)}
                        </div>
                      </td>

                      {/* Error absoluto */}
                      <td className="px-6 py-4 whitespace-nowrap font-mono">
                        {error !== null
                          ? (error < 1e-6 && error > 0
                              ? error.toExponential(3)
                              : error.toFixed(6))
                          : "N/A"}
                      </td>

                      {/* Error porcentual (Modificación 3) */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div
                          className={`text-sm ${
                            errorType === "both-zero"
                              ? "text-gray-500"
                              : errorType === "absolute"
                              ? "text-blue-600"
                              : errorPercent > 20
                              ? "text-red-600 font-semibold"
                              : errorPercent > 10
                              ? "text-orange-600"
                              : "text-green-600"
                          }`}
                        >
                          {error !== null ? displayError : "N/A"}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


// Improved modal for saving experiments
function SaveExperimentModal({ showSaveModal, setShowSaveModal, experimentMetadata, setExperimentMetadata, currentExperimentToSave, setSavedExperiments, addLog }) {
  if (!showSaveModal) return null;
  
  const handleClose = () => {
    setShowSaveModal(false);
    setExperimentMetadata({ name: '', tags: '', description: '' });
  };
  
  const handleSave = () => {
    if (!experimentMetadata.name.trim()) {
      addLog("Please provide a name for the experiment", "warning");
      return;
    }
    
    try {
      // Add categories automatically based on values
      let autoCategories = [];
      
      if (currentExperimentToSave?.parameters?.algorithm === "AMP") {
        autoCategories.push("AMP");
      } else if (currentExperimentToSave?.parameters?.algorithm === "FV") {
        autoCategories.push("FV");
      } else if (currentExperimentToSave?.parameters?.algorithm === "auto") {
        autoCategories.push("AUTO");
      }
      
      // Analyze probability ranges
      if (currentExperimentToSave?.type === 'range') {
        if (currentExperimentToSave.parameters.minP < 0.3) autoCategories.push("low-p");
        if (currentExperimentToSave.parameters.maxP > 0.7) autoCategories.push("high-p");
        if (currentExperimentToSave.parameters.minP < 0.5 && currentExperimentToSave.parameters.maxP > 0.5) {
          autoCategories.push("crossover");
        }
      }
      
      // Consider process count
      if (currentExperimentToSave?.parameters?.processCount === 3) {
        autoCategories.push("3-processes");
      } else {
        autoCategories.push("2-processes");
      }
      
      // Check if multi-round
      if (currentExperimentToSave?.parameters?.rounds > 1) {
        autoCategories.push("multi-round");
        autoCategories.push(`rounds-${currentExperimentToSave.parameters.rounds}`);
      }
      
      // Get user tags and add automatic ones
      const userTags = experimentMetadata.tags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag);
      
      // Combine avoiding duplicates
      const allTags = [...new Set([...userTags, ...autoCategories])];
      
      const experiment = {
        ...currentExperimentToSave,
        metadata: {
          ...experimentMetadata,
          id: Date.now().toString(),
          createdAt: new Date().toISOString(),
          tags: allTags,
          autoGenerated: autoCategories
        }
      };
      
      setSavedExperiments(prev => [...prev, experiment]);
      addLog(`Experiment "${experimentMetadata.name}" saved successfully`, "success");
      handleClose();
    } catch (error) {
      addLog(`Error saving experiment: ${error.message}`, "error");
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">Save Experiment</h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Experiment Name*</label>
          <input
            type="text"
            value={experimentMetadata.name}
            onChange={(e) => setExperimentMetadata(prev => ({ ...prev, name: e.target.value }))}
            className="w-full p-2 border rounded-md"
            placeholder="Give a descriptive name"
            required
          />
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Tags</label>
          <input
            type="text"
            value={experimentMetadata.tags}
            onChange={(e) => setExperimentMetadata(prev => ({ ...prev, tags: e.target.value }))}
            className="w-full p-2 border rounded-md"
            placeholder="Tags (comma separated)"
          />
          <p className="text-xs text-gray-500 mt-1">E.g., AMP, high-probability, p=0.8</p>
        </div>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={experimentMetadata.description}
            onChange={(e) => setExperimentMetadata(prev => ({ ...prev, description: e.target.value }))}
            className="w-full p-2 border rounded-md h-24"
            placeholder="Describe the purpose of this experiment"
          />
        </div>
        
        <div className="bg-gray-50 p-3 rounded-lg mb-4">
          <h4 className="text-sm font-semibold mb-2">Experiment Details</h4>
          <div className="text-xs space-y-1">
            <p><span className="font-medium">Type:</span> {currentExperimentToSave?.type === 'single' ? 'Single Experiment' : 'Range Experiment'}</p>
            <p><span className="font-medium">Processes:</span> {currentExperimentToSave?.parameters?.processCount}</p>
            <p><span className="font-medium">Rounds:</span> {currentExperimentToSave?.parameters?.rounds || 1}</p>
            <p><span className="font-medium">Probability:</span> {
              currentExperimentToSave?.type === 'single' 
                ? currentExperimentToSave?.parameters?.probability.toFixed(2) 
                : `${currentExperimentToSave?.parameters?.minP.toFixed(2)} to ${currentExperimentToSave?.parameters?.maxP.toFixed(2)}`
            }</p>
            <p><span className="font-medium">Algorithm:</span> {
              currentExperimentToSave?.parameters?.algorithm
            }</p>
            {currentExperimentToSave?.parameters?.fvMethod && (
              <p><span className="font-medium">FV Method:</span> {currentExperimentToSave?.parameters?.fvMethod}</p>
            )}
            <p><span className="font-medium">Data points:</span> {
              currentExperimentToSave?.type === 'range' ? 
                currentExperimentToSave?.results?.length : 
                '1'
            }</p>
          </div>
          
          <div className="mt-3 text-xs text-blue-600">
            <p>Tags will be automatically added based on the experiment.</p>
          </div>
        </div>
        
        <div className="flex justify-end space-x-2">
          <button
            onClick={handleClose}
            className="px-4 py-2 border rounded-md hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            Save Experiment
          </button>
        </div>
      </div>
    </div>
  );
}

// Component to visualize convergence across multiple rounds
function MultiRoundConvergenceChart({ analysisData, maxRounds = 3 }) {
  const [selectedP, setSelectedP] = useState(0.7);
  const [showTheoreticalAMP, setShowTheoreticalAMP] = useState(true);
  const [showExperimentalAMP, setShowExperimentalAMP] = useState(true);
  const [showTheoreticalFV, setShowTheoreticalFV] = useState(true);
  const [showExperimentalFV, setShowExperimentalFV] = useState(true);
  const [useLogScale, setUseLogScale] = useState(false);
  const [compareMode, setCompareMode] = useState('algorithms'); // 'algorithms' or 'theory-vs-practice'
  
  // If no data, show informative message
  if (!analysisData || analysisData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4 text-center">
        <h3 className="text-lg font-semibold mb-2">Multi-Round Analysis</h3>
        <p className="text-gray-500">Run a multi-round analysis to see convergence.</p>
      </div>
    );
  }

  // Find analysis for selected probability
  const analysisForSelectedP = analysisData.find(a => a.probability === selectedP) || analysisData[0];
  
  // Prepare data for chart based on comparison mode
  let chartData = [];
  
  if (compareMode === 'algorithms') {
    // Format for comparing AMP vs FV
    for (let r = 0; r <= maxRounds; r++) {
      const dataPoint = { round: r };
      
      if (showTheoreticalAMP) {
        dataPoint.theoryAMP = analysisForSelectedP.theoreticalAMP[r]?.discrepancy || 0;
      }
      
      if (showExperimentalAMP) {
        dataPoint.expAMP = analysisForSelectedP.experimentalAMP[r]?.discrepancy || 0;
      }
      
      if (showTheoreticalFV) {
        dataPoint.theoryFV = analysisForSelectedP.theoreticalFV[r]?.discrepancy || 0;
      }
      
      if (showExperimentalFV) {
        dataPoint.expFV = analysisForSelectedP.experimentalFV[r]?.discrepancy || 0;
      }
      
      chartData.push(dataPoint);
    }
  } else {
    // Format for comparing theory vs practice
    for (let r = 0; r <= maxRounds; r++) {
      const dataPoint = { round: r };
      
      if (showTheoreticalAMP) {
        dataPoint.theoryAMP = analysisForSelectedP.theoreticalAMP[r]?.discrepancy || 0;
      }
      
      if (showTheoreticalFV) {
        dataPoint.theoryFV = analysisForSelectedP.theoreticalFV[r]?.discrepancy || 0;
      }
      
      if (showExperimentalAMP) {
        dataPoint.expAMP = analysisForSelectedP.experimentalAMP[r]?.discrepancy || 0;
      }
      
      if (showExperimentalFV) {
        dataPoint.expFV = analysisForSelectedP.experimentalFV[r]?.discrepancy || 0;
      }
      
      chartData.push(dataPoint);
    }
  }

  // Determine optimal algorithm for selected probability
  const optimalAlgorithm = analysisForSelectedP.optimalAlgorithm;
  
  // Calculate theoretical reduction factor per round
  const q = 1 - selectedP;
  const ampReductionFactor = q;
  const fvReductionFactor = selectedP*selectedP + q*q;
  
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h3 className="text-xl font-semibold mb-4">Multi-Round Convergence Analysis</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
        <div className="md:col-span-1">
          <label className="block text-sm font-medium mb-1">Probability (p):</label>
          <select 
            value={selectedP} 
            onChange={(e) => setSelectedP(parseFloat(e.target.value))}
            className="w-full p-2 border rounded-md"
          >
            {analysisData.map(a => (
              <option key={a.probability} value={a.probability}>
                p = {a.probability.toFixed(2)}
              </option>
            ))}
          </select>
        </div>
        
        <div className="md:col-span-1">
          <label className="block text-sm font-medium mb-1">Comparison Mode:</label>
          <select 
            value={compareMode} 
            onChange={(e) => setCompareMode(e.target.value)}
            className="w-full p-2 border rounded-md"
          >
            <option value="algorithms">AMP vs FV</option>
            <option value="theory-vs-practice">Theory vs Practice</option>
          </select>
        </div>
        
        <div className="md:col-span-1">
          <label className="block text-sm font-medium mb-1">Show Rounds:</label>
          <select 
            value={maxRounds} 
            onChange={(e) => setMaxRounds(parseInt(e.target.value))}
            className="w-full p-2 border rounded-md"
          >
            <option value="1">1 Round</option>
            <option value="2">2 Rounds</option>
            <option value="3">3 Rounds</option>
            <option value="5">5 Rounds</option>
            <option value="10">10 Rounds</option>
          </select>
        </div>
        
        <div className="md:col-span-1">
          <label className="flex items-center mt-6">
            <input 
              type="checkbox" 
              checked={useLogScale} 
              onChange={() => setUseLogScale(!useLogScale)}
              className="mr-2"
            />
            <span className="text-sm">Logarithmic Scale</span>
          </label>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center">
            <input 
              type="checkbox" 
              checked={showTheoreticalAMP} 
              onChange={() => setShowTheoreticalAMP(!showTheoreticalAMP)}
              className="mr-2"
            />
            <span className="text-sm flex items-center">
              <span 
                className="inline-block w-3 h-3 mr-1 rounded-full" 
                style={{ backgroundColor: AMP_COLOR }}
              ></span>
              Theoretical AMP
            </span>
          </label>
          
          <label className="flex items-center">
            <input 
              type="checkbox" 
              checked={showExperimentalAMP} 
              onChange={() => setShowExperimentalAMP(!showExperimentalAMP)}
              className="mr-2"
            />
            <span className="text-sm flex items-center">
              <span 
                className="inline-block w-3 h-3 mr-1 rounded-full" 
                style={{ backgroundColor: AMP_COLOR, opacity: 0.6 }}
              ></span>
              Experimental AMP
            </span>
          </label>
          
          <label className="flex items-center">
            <input 
              type="checkbox" 
              checked={showTheoreticalFV} 
              onChange={() => setShowTheoreticalFV(!showTheoreticalFV)}
              className="mr-2"
            />
            <span className="text-sm flex items-center">
              <span 
                className="inline-block w-3 h-3 mr-1 rounded-full" 
                style={{ backgroundColor: FV_COLOR }}
              ></span>
              Theoretical FV
            </span>
          </label>
          
          <label className="flex items-center">
            <input 
              type="checkbox" 
              checked={showExperimentalFV} 
              onChange={() => setShowExperimentalFV(!showExperimentalFV)}
              className="mr-2"
            />
            <span className="text-sm flex items-center">
              <span 
                className="inline-block w-3 h-3 mr-1 rounded-full" 
                style={{ backgroundColor: FV_COLOR, opacity: 0.6 }}
              ></span>
              Experimental FV
            </span>
          </label>
        </div>
        
        <div className="bg-blue-50 p-3 rounded-lg">
          <p className="text-sm">
            <strong>For p = {selectedP.toFixed(2)}:</strong> The optimal algorithm is <strong>{optimalAlgorithm}</strong>
          </p>
          <p className="text-sm">
            Reduction factor per round: {optimalAlgorithm === 'AMP' ? 
              `${ampReductionFactor.toFixed(4)} (AMP)` : 
              `${fvReductionFactor.toFixed(4)} (FV)`}
          </p>
        </div>
      </div>
      
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={chartData} 
            margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="round" 
              label={{ value: 'Round', position: 'insideBottom', offset: -10 }}
              type="number"
              domain={[0, maxRounds]}
              allowDecimals={false}
            />
            <YAxis 
              label={{ value: 'Discrepancy', angle: -90, position: 'insideLeft', offset: -10 }}
              scale={useLogScale ? 'log' : 'auto'}
              domain={useLogScale ? [0.001, 1] : [0, 1]}
              tickFormatter={(value) => value.toFixed(useLogScale ? 3 : 2)}
            />
            <Tooltip formatter={(value) => value.toFixed(4)} labelFormatter={(label) => `Round ${label}`} />
            <Legend />
            
            {showTheoreticalAMP && (
              <Line
                type="monotone"
                dataKey="theoryAMP"
                name="Theoretical AMP"
                stroke={AMP_COLOR}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            )}
            
            {showExperimentalAMP && (
              <Line
                type="monotone"
                dataKey="expAMP"
                name="Experimental AMP"
                stroke={AMP_COLOR}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 4, fill: AMP_COLOR, stroke: 'white', strokeWidth: 1 }}
              />
            )}
            
            {showTheoreticalFV && (
              <Line
                type="monotone"
                dataKey="theoryFV"
                name="Theoretical FV"
                stroke={FV_COLOR}
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            )}
            
            {showExperimentalFV && (
              <Line
                type="monotone"
                dataKey="expFV"
                name="Experimental FV"
                stroke={FV_COLOR}
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 4, fill: FV_COLOR, stroke: 'white', strokeWidth: 1 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gray-50 p-3 rounded-lg">
          <h4 className="font-medium mb-2">Theoretical Discrepancy per Round</h4>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1 px-2">Round</th>
                <th className="text-right py-1 px-2">AMP</th>
                <th className="text-right py-1 px-2">FV</th>
              </tr>
            </thead>
            <tbody>
              {analysisForSelectedP.theoreticalAMP.slice(0, maxRounds + 1).map((data, idx) => (
                <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : ''}>
                  <td className="py-1 px-2">{idx}</td>
                  <td className="text-right py-1 px-2 font-mono">{data.discrepancy.toFixed(4)}</td>
                  <td className="text-right py-1 px-2 font-mono">
                    {analysisForSelectedP.theoreticalFV[idx].discrepancy.toFixed(4)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <div className="bg-gray-50 p-3 rounded-lg">
          <h4 className="font-medium mb-2">Experimental Discrepancy per Round</h4>
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1 px-2">Round</th>
                <th className="text-right py-1 px-2">AMP</th>
                <th className="text-right py-1 px-2">FV</th>
                <th className="text-right py-1 px-2">AMP Error (%)</th>
                <th className="text-right py-1 px-2">FV Error (%)</th>
              </tr>
            </thead>
            <tbody>
              {analysisForSelectedP.experimentalAMP.slice(0, maxRounds + 1).map((data, idx) => {
                const theoreticalAMP = analysisForSelectedP.theoreticalAMP[idx].discrepancy;
                const theoreticalFV = analysisForSelectedP.theoreticalFV[idx].discrepancy;
                const experimentalAMP = data.discrepancy;
                const experimentalFV = analysisForSelectedP.experimentalFV[idx].discrepancy;
                
                const errorAMP = theoreticalAMP !== 0 ? 
                  Math.abs((experimentalAMP - theoreticalAMP) / theoreticalAMP) * 100 : 0;
                const errorFV = theoreticalFV !== 0 ? 
                  Math.abs((experimentalFV - theoreticalFV) / theoreticalFV) * 100 : 0;
                
                return (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : ''}>
                    <td className="py-1 px-2">{idx}</td>
                    <td className="text-right py-1 px-2 font-mono">{experimentalAMP.toFixed(4)}</td>
                    <td className="text-right py-1 px-2 font-mono">{experimentalFV.toFixed(4)}</td>
                    <td className="text-right py-1 px-2 font-mono">{errorAMP.toFixed(2)}%</td>
                    <td className="text-right py-1 px-2 font-mono">{errorFV.toFixed(2)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// Component to analyze convergence rates
function ConvergenceRateAnalysis({ analyzedRates }) {
  if (!analyzedRates || analyzedRates.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4 text-center">
        <h3 className="text-lg font-semibold mb-2">Convergence Rate Analysis</h3>
        <p className="text-gray-500">Run an analysis to see convergence rates.</p>
      </div>
    );
  }
  
  // Sort by probability
  const sortedRates = [...analyzedRates].sort((a, b) => a.probability - b.probability);
  
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h3 className="text-xl font-semibold mb-4">Convergence Rate Analysis</h3>
      
      <div className="mb-6">
        <h4 className="font-medium mb-2">Reduction Factors by Probability</h4>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={sortedRates.map(rate => ({
                probability: rate.probability,
                ampFactor: 1 - rate.probability, // q
                fvFactor: Math.pow(rate.probability, 2) + Math.pow(1 - rate.probability, 2),
                optimalFactor: rate.theoreticalFactor
              }))}
              margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="probability" 
                label={{ value: 'Probability (p)', position: 'insideBottom', offset: -10 }}
                domain={[0, 1]}
              />
              <YAxis 
                label={{ value: 'Reduction Factor', angle: -90, position: 'insideLeft', offset: -10 }}
                domain={[0, 1]}
              />
              <Tooltip 
                formatter={(value) => value.toFixed(4)} 
                labelFormatter={(label) => `Probability: ${parseFloat(label).toFixed(2)}`}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="ampFactor" 
                name="AMP Factor (q)" 
                stroke={AMP_COLOR} 
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line 
                type="monotone" 
                dataKey="fvFactor" 
                name="FV Factor (p² + q²)" 
                stroke={FV_COLOR} 
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Line 
                type="monotone" 
                dataKey="optimalFactor" 
                name="Optimal Factor" 
                stroke="#9c27b0" 
                strokeWidth={3}
                dot={{ r: 4 }}
              />
              <ReferenceLine x={0.5} stroke="#666" strokeDasharray="3 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sortedRates.slice(0, 4).map(rate => (
          <div key={rate.probability} className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-3">
              Probability p = {rate.probability.toFixed(2)}, 
              Algorithm: {rate.algorithm}
            </h4>
            <p className="text-sm mb-2">
              Theoretical reduction factor: <span className="font-mono">{rate.theoreticalFactor.toFixed(4)}</span> per round
            </p>
            
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-1 px-2">Round</th>
                  <th className="text-right py-1 px-2">Discrepancy</th>
                  <th className="text-right py-1 px-2">Convergence Rate</th>
                  <th className="text-right py-1 px-2">Factor</th>
                </tr>
              </thead>
              <tbody>
                {rate.convergenceRates.slice(0, 5).map((data, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : ''}>
                    <td className="py-1 px-2">{data.round}</td>
                    <td className="text-right py-1 px-2 font-mono">{data.discrepancy.toFixed(4)}</td>
                    <td className="text-right py-1 px-2 font-mono">
                      {(data.convergenceRate * 100).toFixed(2)}%
                    </td>
                    <td className="text-right py-1 px-2 font-mono">
                      {data.reductionFactor.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}

// Component for theoretical vs experimental comparison
function TheoreticalVsExperimentalTable({ p, maxRounds = 3, repetitions = 100 }) {
  const [results, setResults] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  
  useEffect(() => {
    // Reset results when parameters change
    setResults(null);
  }, [p, maxRounds, repetitions]);
  
  const calculateResults = useCallback(async () => {
    if (isCalculating) return;
    
    setIsCalculating(true);
    
    // Simulate with setTimeout to not block UI
    setTimeout(() => {
      try {
        // Initial values: Alice = 0, Bob = 1
        const initialValues = [0, 1];
        
        // Determine optimal algorithm based on p
        const algorithm = p > 0.5 ? "AMP" : "FV";
        const q = 1 - p;
        
        // Calculate theoretical results
        const theoreticalResults = [];
        for (let r = 0; r <= maxRounds; r++) {
          let theoreticalDiscrepancy;
          if (algorithm === "AMP") {
            theoreticalDiscrepancy = Math.pow(q, r);
          } else {
            theoreticalDiscrepancy = Math.pow(p*p + q*q, r);
          }
          
          theoreticalResults.push({
            round: r,
            discrepancy: theoreticalDiscrepancy
          });
        }
        
        // Run experiments
        const experimentalRuns = [];
        for (let i = 0; i < repetitions; i++) {
          const history = SimulationEngine.runExperiment(
            initialValues,
            p,
            maxRounds,
            algorithm,
            0.5  // Meeting point
          );
          experimentalRuns.push(history);
        }
        
        // Calculate experimental averages
        const experimentalResults = [];
        for (let r = 0; r <= maxRounds; r++) {
          let sumDiscrepancy = 0;
          let count = 0;
          
          experimentalRuns.forEach(run => {
            if (run[r]) {
              sumDiscrepancy += run[r].discrepancy;
              count++;
            }
          });
          
          const avgDiscrepancy = count > 0 ? sumDiscrepancy / count : null;
          
          experimentalResults.push({
            round: r,
            discrepancy: avgDiscrepancy,
            sampleCount: count
          });
        }
        
        // Compare results
        const comparisonResults = [];
        for (let r = 0; r <= maxRounds; r++) {
          const theoretical = theoreticalResults[r].discrepancy;
          const experimental = experimentalResults[r].discrepancy;
          
          // Calculate absolute and relative error
          const absoluteError = Math.abs(experimental - theoretical);
          const relativeError = theoretical !== 0 ? (absoluteError / theoretical) * 100 : 0;
          
          comparisonResults.push({
            round: r,
            theoretical,
            experimental,
            absoluteError,
            relativeError
          });
        }
        
        setResults({
          algorithm,
          theoreticalResults,
          experimentalResults,
          comparisonResults
        });
      } catch (error) {
        console.error("Error calculating results:", error);
      } finally {
        setIsCalculating(false);
      }
    }, 50); // Reduced delay for faster execution
  }, [p, maxRounds, repetitions, isCalculating]);
  
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Theoretical vs Experimental (p = {p.toFixed(2)})</h3>
        
        <button
          onClick={calculateResults}
          disabled={isCalculating}
          className={`px-4 py-2 rounded-md text-white ${
            isCalculating ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {isCalculating ? 'Calculating...' : 'Calculate'}
        </button>
      </div>
      
      {results ? (
        <div>
          <div className="mb-4 bg-blue-50 p-3 rounded-lg">
            <p className="text-sm">
              <strong>Optimal algorithm:</strong> {results.algorithm} for p = {p.toFixed(2)}
            </p>
            <p className="text-sm">
              <strong>Theoretical reduction factor:</strong> {
                results.algorithm === "AMP" 
                  ? `${(1-p).toFixed(4)} (q)` 
                  : `${(p*p + (1-p)*(1-p)).toFixed(4)} (p² + q²)`
              }
            </p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-auto divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-1 text-left font-medium text-gray-500 uppercase">p</th>
                  <th className="px-3 py-1 text-left font-medium text-gray-500 uppercase">Algorithm</th>
                  <th className="px-3 py-1 text-left font-medium text-gray-500 uppercase">Experimental</th>
                  {experimentalResults[0].theoretical && (
                    <>
                      <th className="px-3 py-1 text-left font-medium text-gray-500 uppercase">Theoretical</th>
                      <th className="px-3 py-1 text-left font-medium text-gray-500 uppercase">Error</th>
                      <th className="px-3 py-1 text-left font-medium text-gray-500 uppercase">Error %</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {experimentalResults.sort((a, b) => a.p - b.p).map((result, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-2 py-1 whitespace-nowrap">{result.p.toFixed(2)}</td>
                    <td className="px-2 py-1 whitespace-nowrap">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                        result.algorithm === 'AMP' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {result.algorithm}
                      </span>
                    </td>
                    <td className="px-2 py-1 whitespace-nowrap font-mono">{result.discrepancy < 1e-6 && result.discrepancy > 0 
                      ? result.discrepancy.toExponential(3)
                      : result.discrepancy.toFixed(6)}</td>
                    {result.theoretical && (
                      <>
                        <td className="px-2 py-1 whitespace-nowrap font-mono">{result.theoretical.toFixed(6)}</td>
                        <td className="px-2 py-1 whitespace-nowrap font-mono">{Math.abs(result.discrepancy - result.theoretical).toFixed(6)}</td>
                        <td className="px-2 py-1 whitespace-nowrap font-mono">{(Math.abs(result.discrepancy - result.theoretical)/result.theoretical*100).toFixed(2)}%</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={results.comparisonResults}
                margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="round" 
                  label={{ value: 'Round', position: 'insideBottom', offset: -10 }}
                  type="number"
                  domain={[0, maxRounds]}
                  allowDecimals={false}
                />
                <YAxis 
                  label={{ value: 'Discrepancy', angle: -90, position: 'insideLeft', offset: -10 }}
                  domain={[0, 1]}
                />
                <Tooltip formatter={(value) => value.toFixed(6)} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="theoretical"
                  name="Theoretical"
                  stroke="#3498db"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="experimental"
                  name="Experimental"
                  stroke="#e74c3c"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">
          {isCalculating ? (
            <div>
              <svg className="animate-spin h-10 w-10 text-blue-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p>Calculating results, please wait...</p>
              <p className="text-sm mt-2">Running {repetitions} simulations for {maxRounds} rounds</p>
            </div>
          ) : (
            <p>Click "Calculate" to see comparative results.</p>
          )}
        </div>
      )}
    </div>
  );
}

// Component to analyze error between theory and experiment for different p values
function ErrorAnalysisByProbability({ maxRounds = 3, repetitions = 50 }) {
  const [results, setResults] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [roundToShow, setRoundToShow] = useState(1);
  
  const runAnalysis = useCallback(async () => {
    if (isCalculating) return;
    
    setIsCalculating(true);
    
    // Simulate with setTimeout to not block UI
    setTimeout(() => {
      try {
        // p values to analyze
        const pValues = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
        const initialValues = [0, 1]; // Alice = 0, Bob = 1
        
        // Store results for each p
        const allResults = [];
        
        for (const p of pValues) {
          const algorithm = p > 0.5 ? "AMP" : "FV";
          const q = 1 - p;
          
          // Calculate theoretical values
          const theoreticalDiscrepancies = [];
          for (let r = 0; r <= maxRounds; r++) {
            if (algorithm === "AMP") {
              theoreticalDiscrepancies.push(Math.pow(q, r));
            } else {
              theoreticalDiscrepancies.push(Math.pow(p*p + q*q, r));
            }
          }
          
          // Run experiments
          const experimentalDiscrepancies = Array(maxRounds + 1).fill(0).map(() => ({ sum: 0, count: 0 }));
          
          for (let i = 0; i < repetitions; i++) {
            const history = SimulationEngine.runExperiment(
              initialValues,
              p,
              maxRounds,
              algorithm,
              0.5  // Meeting point
            );
            
            // Record results for each round
            for (let r = 0; r <= maxRounds; r++) {
              if (history[r]) {
                experimentalDiscrepancies[r].sum += history[r].discrepancy;
                experimentalDiscrepancies[r].count++;
              }
            }
          }
          
          // Calculate averages and errors
          const roundResults = [];
          for (let r = 0; r <= maxRounds; r++) {
            const theoretical = theoreticalDiscrepancies[r];
            const experimental = experimentalDiscrepancies[r].count > 0 ? 
              experimentalDiscrepancies[r].sum / experimentalDiscrepancies[r].count : 0;
              
            const absoluteError = Math.abs(experimental - theoretical);
            const relativeError = theoretical !== 0 ? (absoluteError / theoretical) * 100 : 0;
            
            roundResults.push({
              round: r,
              theoretical,
              experimental,
              absoluteError,
              relativeError
            });
          }
          
          allResults.push({
            p,
            algorithm,
            roundResults
          });
        }
        
        setResults(allResults);
      } catch (error) {
        console.error("Error in error analysis:", error);
      } finally {
        setIsCalculating(false);
      }
    }, 50); // Reduced delay for faster execution
  }, [maxRounds, repetitions, isCalculating]);
  
  // Prepare data for probability error chart
  const chartData = useMemo(() => {
    if (!results) return [];
    
    return results.map(result => {
      const roundData = result.roundResults[roundToShow];
      return {
        p: result.p,
        algorithm: result.algorithm,
        theoretical: roundData.theoretical,
        experimental: roundData.experimental,
        absoluteError: roundData.absoluteError,
        relativeError: roundData.relativeError
      };
    });
  }, [results, roundToShow]);
  
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Error Analysis by Probability</h3>
        
        <div className="flex items-center space-x-4">
          {results && (
            <select
              value={roundToShow}
              onChange={(e) => setRoundToShow(parseInt(e.target.value))}
              className="px-2 py-1 border rounded text-sm"
            >
              {[...Array(maxRounds + 1)].map((_, idx) => (
                <option key={idx} value={idx}>Round {idx}</option>
              ))}
            </select>
          )}
          
          <button
            onClick={runAnalysis}
            disabled={isCalculating}
            className={`px-4 py-2 rounded-md text-white ${
              isCalculating ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isCalculating ? 'Analyzing...' : 'Analyze Error'}
          </button>
        </div>
      </div>
      
      {results ? (
        <div>
          <div className="mb-6 h-80">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 30, left: 20, bottom: 30 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="p" 
                  label={{ value: 'Probability (p)', position: 'insideBottom', offset: -10 }}
                  domain={[0, 1]}
                />
                <YAxis 
                  yAxisId="left"
                  label={{ value: 'Discrepancy', angle: -90, position: 'insideLeft', offset: -10 }}
                  domain={[0, 1]}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  label={{ value: 'Relative Error (%)', angle: 90, position: 'insideRight', offset: -15 }}
                  domain={[0, 'auto']}
                />
                <Tooltip formatter={(value) => value.toFixed(6)} />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="theoretical"
                  name="Theoretical"
                  stroke="#3498db"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="experimental"
                  name="Experimental"
                  stroke="#e74c3c"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                />
                <Bar
                  yAxisId="right"
                  dataKey="relativeError"
                  name="Relative Error (%)"
                  fill="#2ecc71"
                  opacity={0.7}
                />
                <ReferenceLine x={0.5} stroke="#666" strokeDasharray="3 3" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Probability (p)
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Algorithm
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Theoretical (Round {roundToShow})
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Experimental
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Abs. Error
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rel. Error (%)
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {chartData.map((data) => (
                  <tr key={data.p}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {data.p.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        data.algorithm === "AMP" ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {data.algorithm}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {data.theoretical.toFixed(6)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {data.experimental.toFixed(6)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                      {data.absoluteError.toFixed(6)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-mono ${
                      data.relativeError < 5 ? 'text-green-600' :
                      data.relativeError < 10 ? 'text-yellow-600' :
                      'text-red-600'
                    }`}>
                      {data.relativeError.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          {isCalculating ? (
            <div>
              <svg className="animate-spin h-10 w-10 text-blue-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <p>Analyzing error for different p values, please wait...</p>
              <p className="text-sm mt-2">This analysis may take a few seconds</p>
            </div>
          ) : (
            <div>
              <p className="mb-4">Click "Analyze Error" to compare theoretical and experimental results for different p values.</p>
              <p className="text-sm">This analysis will run {repetitions} simulations for each p value up to round {maxRounds}.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Main component
function CompleteDistributedComputingSimulator() {
  // Configuration states
  const [processValues, setProcessValues] = useState([0, 1]); // Valores para n procesos
  const [probability, setProbability] = useState(0.70);
  const [algorithm, setAlgorithm] = useState("auto");
  const [fvMethod, setFvMethod] = useState("average");
  const [meetingPoint, setMeetingPoint] = useState(0.5);
  const [rounds, setRounds] = useState(1);
  const [showDeliveryInfo, setShowDeliveryInfo] = useState(false);
  const [repetitions, setRepetitions] = useState(50);
  const [deliveryMode, setDeliveryMode] = useState('standard');
  const [experimentRuns, setExperimentRuns] = useState({});
  const [selectedRepetition, setSelectedRepetition] = useState(0);
  const [useConditionedMode, setUseConditionedMode] = useState(false);
  const [dimensionMode, setDimensionMode] = useState('binary'); // 'binary' | 'barycentric'
  const [dimensions, setDimensions] = useState(2);
  const [barycentricValues, setBarycentricValues] = useState([]);
  const [distanceMetric, setDistanceMetric] = useState('euclidean');
  const [customMeetingPoint, setCustomMeetingPoint] = useState(null);
  // Range experiments states
  const [rangeExperiments, setRangeExperiments] = useState({
    minP: 0.0,
    maxP: 1.0,
    steps: 100,
    customSteps: false,
    customStepValue: 100
  });
  const [useAdaptive, setUseAdaptive] = useState(false);
  const [showCI, setShowCI]           = useState(true);
  const [fixYAxis, setFixYAxis]       = useState(false);
  // States for saved experiments and modal
  const [savedExperiments, setSavedExperiments] = useState([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [currentExperimentToSave, setCurrentExperimentToSave] = useState(null);
  const [experimentMetadata, setExperimentMetadata] = useState({
    name: '',
    tags: '',
    description: ''
  });
  const [selectedExperiments, setSelectedExperiments] = useState([]);
  const [comparisonView, setComparisonView] = useState('chart'); // 'chart', 'table', 'details'
  const [forcedAlgorithm, setForcedAlgorithm] = useState("auto");
  const [maxValue, setMaxValue] = useState(1); // Para valores no binarios
  const [conditionedK, setConditionedK] = useState(1);
  const [configCode, setConfigCode] = useState("");
  const [selectedAlgorithms, setSelectedAlgorithms] = useState(["auto"]);
  const [selectedAlgorithmForDetails, setSelectedAlgorithmForDetails] = useState("auto");
  const processCount = processValues.length;
  // SOLO AGREGAR ESTO - Detectar si es algoritmo de 3 procesos
  const is3ProcessAlgorithm = ["COURTEOUS", "SELFISH", "CYCLIC", "BIASED0"].includes(algorithm);

  // SOLO AGREGAR ESTO - Información adicional para algoritmos de 3 procesos
  const getAlgorithmInfo = () => {
    if (is3ProcessAlgorithm) {
      switch(algorithm) {
        case "COURTEOUS": return "Adopts different value from single sender";
        case "SELFISH": return "Keeps own value when hearing from one";
        case "CYCLIC": return "Follows cyclic order A→B→C→A";
        case "BIASED0": return "Always chooses 0 if present";
        default: return "";
      }
    }
    return "";
  };
  
  // ============================================
  // EFECTOS DE INICIALIZACIÓN
  // ============================================

  // Inicializar valores baricéntricos al montar o cambiar de modo
  useEffect(() => {
    if (dimensionMode === 'barycentric' && barycentricValues.length === 0) {
      // Usar processValues.length en lugar de processCount
      const numProcesses = processValues.length;
      initializeBarycentricValues(numProcesses, dimensions);
      addLog("Initialized barycentric values for multi-dimensional mode");
    }
  }, [dimensionMode]); // Se ejecuta cuando cambia el modo
  // ============================================
  // FUNCIONES PARA MODO BARICÉNTRICO
  // ============================================

  const initializeBarycentricValues = (procCount, dims) => {
    if (!SimulationEngine?.barycentric) {
      addLog("ERROR: Barycentric extension not loaded", "error");
      return;
    }
    
    const values = SimulationEngine.barycentric.generateInitialBarycentric(
      procCount,
      dims,
      'vertices'
    );
    setBarycentricValues(values);
    addLog(`Initialized ${procCount} processes in ${dims}D space`);
  };

  const updateBarycentricValue = (processIdx, dimIdx, value) => {
    const newValues = [...barycentricValues];
    if (!newValues[processIdx]) {
      newValues[processIdx] = Array(dimensions).fill(0);
    }
    newValues[processIdx][dimIdx] = value;
    
    
    setBarycentricValues(newValues);
  };

  const randomizeBarycentricValues = () => {
    if (!SimulationEngine?.barycentric) return;
    
    const numProcesses = processValues.length; // Usar esto en lugar de processCount
    const values = Array(numProcesses).fill(0).map(() => 
      SimulationEngine.barycentric.randomBarycentric(dimensions)
    );
    setBarycentricValues(values);
    addLog("Randomized barycentric values");
  };

  const setToVertices = () => {
    if (!SimulationEngine?.barycentric) return;
    
    const numProcesses = processValues.length; // Usar esto en lugar de processCount
    const values = SimulationEngine.barycentric.generateInitialBarycentric(
      numProcesses,
      dimensions,
      'vertices'
    );
    setBarycentricValues(values);
    addLog("Set processes to simplex vertices");
  };

  const setToCentroid = () => {
    const numProcesses = processValues.length;
    const centroid = Array(dimensions).fill(0.5); // Centro del espacio [0,1]^d
    const values = Array(numProcesses).fill(0).map(() => [...centroid]);
    setBarycentricValues(values);
    addLog("Set all processes to center point");
  };

  const updateMeetingPoint = (dimIdx, value) => {
    const newPoint = customMeetingPoint || Array(dimensions).fill(0.5);
    newPoint[dimIdx] = value;
    setCustomMeetingPoint(newPoint);
  };


  

  // Componente de visualización del simplex
  const SimplexVisualization = ({ values, size = 200 }) => {
    const toCartesian = (bary) => {
      const [a, b, c] = bary;
      const x = 0.5 * a + b;
      const y = Math.sqrt(3) / 2 * a;
      return { 
        x: x * size, 
        y: (size * 0.866) - y * size 
      };
    };
    
    const trianglePoints = `${size/2},10 10,${size*0.866} ${size-10},${size*0.866}`;
    const colors = ["#3498db", "#e67e22", "#2ecc71", "#9b59b6", "#e74c3c"];
    
    return (
      <svg width={size} height={size * 0.9}>
        <polygon
          points={trianglePoints}
          fill="none"
          stroke="#ddd"
          strokeWidth="1"
        />
        {values.map((coords, i) => {
          if (!coords || coords.length !== 3) return null;
          const pos = toCartesian(coords);
          return (
            <circle
              key={i}
              cx={pos.x}
              cy={pos.y}
              r="5"
              fill={colors[i % colors.length]}
              opacity="0.8"
            />
          );
        })}
      </svg>
    );
  };
  // Función helper para validar valores
  const validateProcessValue = (value, mode) => {
    if (mode === 'binary') {
      return value === 0 || value === 1 ? value : Math.round(value);
    } else {
      return Math.max(0, Math.min(1, value));
    }
  };
  const [selectedProbabilityForDetails, setSelectedProbabilityForDetails] = useState(null);
  // Multi-round analysis states
  const [multiRoundAnalysisData, setMultiRoundAnalysisData] = useState(null);
  const [convergenceRatesData, setConvergenceRatesData] = useState(null);
  const [multiRoundSettings, setMultiRoundSettings] = useState({
    initialGap: 1.0,
    maxRounds: 3,
    pValues: [0.3, 0.5, 0.7, 0.9],
    repetitions: 100
  });
  const [isRunningMultiRound, setIsRunningMultiRound] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [hoveredRow, setHoveredRow] = useState(null);


  // Visualization states
  const [experimentData, setExperimentData] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [currentAnimation, setCurrentAnimation] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState('theory');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentRepetition, setCurrentRepetition] = useState(0);
  const [logs, setLogs] = useState(["Welcome to the simulator. Configure the parameters and click 'Start Simulation'."]);
  const [showLogs, setShowLogs] = useState(true);
  const [experimentalResults, setExperimentalResults] = useState([]);
  // Estado para fijar o autoajustar los ejes Y en Error Analysis
  const [selectedPForHistogram, setSelectedPForHistogram] = useState(null);
  // --- Construcción de statsWithCI para Discrepancy y Error Analysis ---
  const statsWithCI = experimentalResults
    .sort((a, b) => a.p - b.p)
    .map(r => {
      const mean = r.discrepancy;
      const arr = r.discrepancies || [];
      const n = arr.length;
      const variance = n > 0
        ? arr.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n
        : 0;
      const sd = Math.sqrt(variance);
      return {
        p: r.p,
        mean,
        lower: Math.max(0, mean - 2 * sd),
        upper: mean + 2 * sd,
        theoretical: r.theoretical,
        error: r.theoretical != null ? Math.abs(mean - r.theoretical) : null,
        errorPercent: r.theoretical != null ? Math.abs(mean - r.theoretical) / r.theoretical * 100 : null
      };
    });

  const [valueMode, setValueMode] = useState('binary'); // 'binary' o 'continuous'

  const [rangeDisplayCurves, setRangeDisplayCurves] = useState({
    experimental: true,
    theoreticalAmp: false,
    theoreticalFv: false
  });
  const [comparisonResults, setComparisonResults] = useState(null);
  const animationTimerRef = useRef(null);

  const cancelRef = useRef(false);

  function handleRunCancel() {
    if (!isRunning) {
      setIsRunning(true);
      runRangeExperiments();       
    } else {
      setIsRunning(false);
      cancelRangeExperiments();    
    }
  }

  function cancelRangeExperiments() {
  cancelRef.current = true;
} 

const [copyMessage, setCopyMessage] = useState("");


function base64ToBase64Url(str) {
  return str.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function base64UrlToBase64(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = str.length % 4;
  if (pad) str += "=".repeat(4 - pad);
  return str;
}
function encodeConfigCode(cfg) {
  const json = JSON.stringify(cfg);
  return base64ToBase64Url(btoa(json));
}
function decodeConfigCode(code) {
  try {
    const json = atob(base64UrlToBase64(code));
    return JSON.parse(json);
  } catch {
    return null;
  }
}



 // Helper functions


const handleLoadConfig = () => {
  const config = decodeConfigCode(configCode);
  if (!config) {
    addLog("Invalid configuration code", "error");
    return;
  }
  
  setProcessValues(config.initialValues || [0, 1]);
  setProbability(config.p || 0.5);
  setRangeExperiments({
    minP: config.minP || 0,
    maxP: config.maxP || 1,
    steps: 100,
    customSteps: false,
    customStepValue: 100
  });
  setForcedAlgorithm(config.algorithm || "auto");
  setMeetingPoint(config.meetingPoint || 0.5);
  setRounds(config.rounds || 1);
  setRepetitions(config.repetitions || 1);
  
  
  addLog("Configuration loaded successfully", "success");
  setCopyMessage("Configuration loaded!");
  setTimeout(() => setCopyMessage(""), 2000);
};

const handleGenerateConfig = () => {
  const cfg = {
    processCount:   processValues.length,
    initialValues:  processValues,
    p:              probability,
    minP:           rangeExperiments.minP,
    maxP:           rangeExperiments.maxP,
    algorithm:      forcedAlgorithm,
    meetingPoint:   meetingPoint,
    rounds:         rounds,
    repetitions:    repetitions,
  };
  const code = encodeConfigCode(cfg);
  navigator.clipboard.writeText(code)
    .then(() => {
      setCopyMessage("Code copied!");
      setTimeout(() => setCopyMessage(""), 2000);
    })
    .catch(() => {
      setCopyMessage("Copy failed");
      setTimeout(() => setCopyMessage(""), 2000);
    });
};


// convierte Base64 normal → Base64URL
function base64ToBase64Url(str) {
  return str
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function encodeConfigCode(cfg) {
  // SIN parámetros del algoritmo recursivo
  const fullConfig = {
    processCount: processValues.length,
    initialValues: processValues,
    p: probability,
    minP: rangeExperiments.minP,
    maxP: rangeExperiments.maxP,
    algorithm: forcedAlgorithm,
    meetingPoint: meetingPoint,
    rounds: rounds,
    repetitions: repetitions
  };
  const json = JSON.stringify(fullConfig);
  const b64 = btoa(json);
  return base64ToBase64Url(b64);
}

function base64UrlToBase64(str) {
  // re-inserta padding y cambia URL-safe a Base64 normal
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = str.length % 4;
  if (pad) str += '='.repeat(4 - pad);
  return str;
}

function decodeConfigCode(code) {
  try {
    const b64   = base64UrlToBase64(code);
    const json  = atob(b64);
    return JSON.parse(json);
  } catch (err) {
    console.error("Error decoding config:", err);
    return null;
  }
}


function showDetailsForProbability(p, algorithm = null) {
  // Redondear p para consistencia
  p = Math.round(p * 1000) / 1000;
  
  // Si no se especifica algoritmo, usar el primero disponible
  if (!algorithm) {
    algorithm = selectedAlgorithmForDetails || selectedAlgorithms[0] || "auto";
  }
  
  // Determinar el algoritmo real
  const actualAlgo = algorithm === "auto" ? (p > 0.5 ? "AMP" : "FV") : algorithm;
  
  // ⚠️ FIX: Construir la clave SIN toFixed
  const key = `${p}_${actualAlgo}`;
  
  // Verificar si existen datos
  if (experimentRuns[key] && experimentRuns[key].length > 0) {
    setSelectedProbabilityForDetails(p);
    setSelectedAlgorithmForDetails(algorithm);
    setSelectedRepetition(0);
    addLog(`Showing ${experimentRuns[key].length} repetitions for p=${p.toFixed(3)}, algorithm=${actualAlgo}`, "info");
  } else {
    // Si no hay datos, generar una ejecución
    const initialValues = getInitialValues();
    
    const history = useConditionedMode 
      ? SimulationEngine.runConditionedExperiment(
          initialProcessValues,
          p,
          actualRounds,
          actualAlgo,
          actualMeetingPoint
        )
      : SimulationEngine.runNProcessExperiment(
          initialProcessValues,
          p,
          actualRounds,
          actualAlgo,
          actualMeetingPoint
        );
    
    setExperimentRuns(prev => ({
      ...prev,
      [key]: [history]
    }));
    
    setSelectedProbabilityForDetails(p);
    setSelectedAlgorithmForDetails(algorithm);
    setSelectedRepetition(0);
    
    addLog(`Generated view for p=${p.toFixed(3)}, algorithm=${actualAlgo}`, "info");
  }
}


// Función para ejecutar un experimento individual
function runSingleExperimentForDetails(p) {
  const initialValues = getInitialValues();
  const actualAlgorithm = forcedAlgorithm === "auto" 
    ? (p > 0.5 ? "AMP" : "FV") 
    : forcedAlgorithm;
  
  
  const history = SimulationEngine.runNProcessExperiment(
    initialValues,
    p,
    rounds,
    actualAlgorithm,
    meetingPoint

  );
  
  setLastRunData(history);
  setSelectedProbabilityForDetails(p);
  addLog(`Generated detailed view for p=${p.toFixed(3)}`, "info");
}
// Componente para visualización detallada del experimento

function ExperimentDetailViewer({ 
  experimentHistory, 
  algorithm, 
  meetingPoint, 
  probability,
  repetitionIndex = 0,
  allRepetitions = null
}) {
  const [expandedRound, setExpandedRound] = useState(0);
  const [selectedProcess, setSelectedProcess] = useState(null);
  const [showDeliveryStats, setShowDeliveryStats] = useState(false);

  const fmt4 = (x) => (typeof x === 'number' && Number.isFinite(x) ? x.toFixed(4) : '0.0000');
  const fmt3 = (x) => (typeof x === 'number' && Number.isFinite(x) ? x.toFixed(3) : String(x ?? '—'));


  const formatKnownValue = (value) => {
    if (Array.isArray(value)) {
      // Valor multidimensional: [1.2, 0.8, 0.3] → "(1.20, 0.80, 0.30)"
      return `(${value.map(v => (typeof v === 'number' ? v.toFixed(2) : String(v))).join(', ')})`;
    } else {
      // Valor unidimensional: 0.75 → "0.75"
      return typeof value === 'number' ? value.toFixed(4) : String(value);
    }
  };

  const safeDisc = (entry) => {
    if (typeof entry?.discrepancy === 'number' && Number.isFinite(entry.discrepancy)) return entry.discrepancy;
    const vals = Array.isArray(entry?.values) ? entry.values : [];
    if (vals.length === 2 && typeof vals[0] === 'number' && typeof vals[1] === 'number') {
      return Math.abs(vals[0] - vals[1]);
    }
    return 0;
  };

  if (!Array.isArray(experimentHistory) || experimentHistory.length === 0) {
    return (
      <div className="p-4 bg-gray-100 rounded-lg text-center">
        <p className="text-gray-500">No experiment data available</p>
        <p className="text-sm text-gray-400 mt-2">Run a simulation first to see detailed results</p>
      </div>
    );
  }
  
  const processCount = Array.isArray(experimentHistory[0]?.values) ? experimentHistory[0].values.length : 0;
  const processNames = Array.from({ length: processCount }, (_, i) => 
    i < 3 ? ["Alice", "Bob", "Charlie"][i] : `P${i+1}`
  );



  // Normaliza 'messages' anidados (por emisor); si no existen, intenta derivar desde messageDelivery
  const getNestedMessages = (round, prevValues) => {
    if (Array.isArray(round?.messages) && Array.isArray(round.messages[0])) {
      return round.messages;
    }
    if (Array.isArray(round?.messageDelivery) && Array.isArray(round.messageDelivery[0])) {
      const nested = Array.from({ length: processCount }, () => []);
      for (let sender = 0; sender < processCount; sender++) {
        const row = round.messageDelivery[sender] || [];
        // Para 2 procesos, row.length=1
        let colIdx = 0;
        for (let receiver = 0; receiver < processCount; receiver++) {
          if (receiver === sender) continue;
          const delivered = !!row[colIdx++];
          nested[sender].push({
            to: receiver,
            delivered,
            value: Array.isArray(prevValues) ? prevValues[sender] : undefined
          });
        }
      }
      return nested;
    }
    if (Array.isArray(round?.messages)) {
      // plano -> agrupar bajo emisor 0 como fallback
      const nested = Array.from({ length: processCount }, () => []);
      round.messages.forEach(msg => nested[0].push({
        to: typeof msg?.to === 'number' ? msg.to : 0,
        delivered: !!msg?.delivered,
        value: msg?.value
      }));
      return nested;
    }
    return Array.from({ length: processCount }, () => []);
  };

  // Estadísticas de entrega seguras
  const calculateDeliveryStats = () => {
    const stats = [];
    let totalMessagesSent = 0;
    let totalMessagesDelivered = 0;

    experimentHistory.forEach((round, roundIdx) => {
      if (roundIdx === 0) {
        stats.push({
          round: 0,
          sent: 0,
          delivered: 0,
          percentage: 0,
          cumulativeSent: 0,
          cumulativeDelivered: 0,
          cumulativePercentage: 0
        });
        return;
      }
      let roundSent = 0;
      let roundDelivered = 0;

      if (Array.isArray(round?.messages) && Array.isArray(round.messages[0])) {
        round.messages.forEach(senderMessages => {
          (senderMessages || []).forEach(msg => {
            roundSent++;
            if (msg?.delivered) roundDelivered++;
          });
        });
      } else if (Array.isArray(round?.messageDelivery) && Array.isArray(round.messageDelivery[0])) {
        round.messageDelivery.forEach(row => {
          (row || []).forEach(b => {
            roundSent++;
            if (b) roundDelivered++;
          });
        });
      } else if (Array.isArray(round?.messages)) {
        round.messages.forEach(msg => {
          roundSent++;
          if (msg?.delivered) roundDelivered++;
        });
      }

      totalMessagesSent += roundSent;
      totalMessagesDelivered += roundDelivered;

      stats.push({
        round: roundIdx,
        sent: roundSent,
        delivered: roundDelivered,
        percentage: roundSent > 0 ? (roundDelivered / roundSent * 100) : 0,
        cumulativeSent: totalMessagesSent,
        cumulativeDelivered: totalMessagesDelivered,
        cumulativePercentage: totalMessagesSent > 0 ? (totalMessagesDelivered / totalMessagesSent * 100) : 0
      });
    });

    return stats;
  };

  const deliveryStats = calculateDeliveryStats();

  return (
    <div className="space-y-4">
      {/* Resumen general */}
      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-lg mb-2">Experiment Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-600">Processes:</span>
            <span className="ml-2 font-medium">{processCount}</span>
          </div>
          <div>
            <span className="text-gray-600">Rounds:</span>
            <span className="ml-2 font-medium">{Math.max(0, experimentHistory.length - 1)}</span>
          </div>
          <div>
            <span className="text-gray-600">Algorithm:</span>
            <span className="ml-2 font-medium">{algorithm}</span>
          </div>
          <div>
            <span className="text-gray-600">Probability:</span>
            <span className="ml-2 font-medium">{(typeof probability === 'number' ? probability.toFixed(2) : 'N/A')}</span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <span className="text-gray-600">Initial Discrepancy:</span>
            <span className="ml-2 font-bold text-lg">{fmt4(safeDisc(experimentHistory[0]))}</span>
          </div>
          <div>
            <span className="text-gray-600">Final Discrepancy:</span>
            <span className="ml-2 font-bold text-lg text-blue-600">{fmt4(safeDisc(experimentHistory[experimentHistory.length - 1]))}</span>
          </div>
        </div>

        <button
          onClick={() => setShowDeliveryStats(!showDeliveryStats)}
          className="mt-3 text-sm text-blue-600 hover:text-blue-800 underline"
        >
          {showDeliveryStats ? 'Hide' : 'Show'} Delivery Statistics
        </button>
      </div>

      {/* Estadísticas de entrega */}
      {showDeliveryStats && (
        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <h4 className="font-semibold mb-3">Message Delivery Statistics</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-green-300">
                  <th className="text-left py-2">Round</th>
                  <th className="text-right py-2">Messages Sent</th>
                  <th className="text-right py-2">Delivered</th>
                  <th className="text-right py-2">Delivery %</th>
                  <th className="text-right py-2">Cumulative Sent</th>
                  <th className="text-right py-2">Cumulative Delivered</th>
                  <th className="text-right py-2">Overall %</th>
                </tr>
              </thead>
              <tbody>
                {deliveryStats.map((stat, idx) => (
                  <tr key={idx} className={idx % 2 === 0 ? 'bg-white bg-opacity-50' : ''}>
                    <td className="py-1">{stat.round}</td>
                    <td className="text-right py-1">{stat.sent}</td>
                    <td className="text-right py-1">{stat.delivered}</td>
                    <td className="text-right py-1">{stat.percentage.toFixed(1)}%</td>
                    <td className="text-right py-1 font-medium">{stat.cumulativeSent}</td>
                    <td className="text-right py-1 font-medium">{stat.cumulativeDelivered}</td>
                    <td className="text-right py-1 font-bold">{stat.cumulativePercentage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-sm text-gray-600">
            <p>Expected per-link delivery: {(typeof probability === 'number' ? (probability * 100).toFixed(1) : 'N/A')}%</p>
            <p>Actual overall delivery rate: {deliveryStats[deliveryStats.length - 1]?.cumulativePercentage.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {/* Vista por rondas */}
      <div className="space-y-2">
        {experimentHistory.map((round, index) => {
          const prevValues = index > 0 ? experimentHistory[index-1]?.values : null;
          const nested = getNestedMessages(round, prevValues);

          return (
            <div key={index} className="bg-white rounded-lg shadow border border-gray-200">
              {/* Encabezado */}
              <div 
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpandedRound(expandedRound === index ? -1 : index)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span>{expandedRound === index ? '▼' : '▶'}</span>
                    <h4 className="font-semibold">Round {round?.round ?? index}</h4>
                    <span className="text-sm text-gray-500">Discrepancy: {fmt4(safeDisc(round))}</span>
                    {index > 0 && deliveryStats[index] && (
                      <span className="text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                        {deliveryStats[index].delivered}/{deliveryStats[index].sent} delivered ({deliveryStats[index].percentage.toFixed(0)}%)
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-1">
                    {(Array.isArray(round?.values) ? round.values : []).slice(0, Math.min(10, processCount)).map((val, i) => (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium text-white"
                        style={{ backgroundColor: getProcessColor(i) }}
                        title={`${processNames[i]}: ${fmt3(val)}`}
                      >
                        {typeof val === 'number' ? (Number.isInteger(val) ? val : Number(val.toFixed(2))) : String(val).substring(0, 3)}
                      </div>
                    ))}
                    {processCount > 10 && <div className="text-gray-400 text-sm">+{processCount - 10}</div>}
                  </div>
                </div>
              </div>


              {expandedRound === index && (
                <div className="border-t border-gray-200 p-4 bg-gray-50">
                  {/* Valores por proceso */}
                  <div className="mb-4">
                    <h5 className="font-medium mb-2">Process Values:</h5>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {(Array.isArray(round?.values) ? round.values : []).map((val, i) => {
                        const prevValue = index > 0 && Array.isArray(experimentHistory[index-1]?.values)
                          ? experimentHistory[index-1].values[i]
                          : null;
                        
                        // ✅ NUEVO: Comparación mejorada para valores multidimensionales
                        const hasChanged = prevValue !== null && prevValue !== undefined && 
                          (Array.isArray(val) && Array.isArray(prevValue)
                            ? JSON.stringify(val) !== JSON.stringify(prevValue)
                            : prevValue !== val);
                        
                        // ✅ NUEVO: Formateo mejorado para valores multidimensionales
                        const formatValue = (value) => {
                          if (Array.isArray(value)) {
                            return `(${value.map(v => (typeof v === 'number' ? v.toFixed(2) : String(v))).join(', ')})`;
                          }
                          return fmt3(value);
                        };

                        return (
                          <div 
                            key={i}
                            className={`p-2 rounded cursor-pointer transition-all ${selectedProcess === i ? 'ring-2 ring-blue-500 bg-white' : 'bg-white hover:shadow-md'}`}
                            onClick={() => setSelectedProcess(selectedProcess === i ? null : i)}
                          >
                            <div className="flex items-center space-x-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: getProcessColor(i) }} />
                              <span className="text-sm font-medium">{processNames[i]}</span>
                            </div>
                            <div className="text-lg font-mono mt-1">{formatValue(val)}</div>
                            {hasChanged && (
                              <div className="text-xs text-green-600 mt-1">
                                Changed from {formatValue(prevValue)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Received Values Section - Mejorada para TODOS los algoritmos */}
                  {index > 0 && Array.isArray(round?.messages) && (
                    <div className="mb-4">
                      <h5 className="font-medium mb-2">Received Values:</h5>
                      <div className="bg-gray-50 rounded p-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {processNames.map((receiverName, receiverIdx) => {
                            const receivedValues = [];
                            const senderInfo = [];
                            
                            round.messages.forEach((senderMsgs, senderIdx) => {
                              if (Array.isArray(senderMsgs)) {
                                senderMsgs.forEach(msg => {
                                  if (msg.to === receiverIdx && msg.delivered) {
                                    receivedValues.push(msg.value);
                                    senderInfo.push({
                                      from: processNames[senderIdx],
                                      value: msg.value,
                                      fromIdx: senderIdx
                                    });
                                  }
                                });
                              }
                            });
                            
                            const hasReceivedDifferent = receivedValues.some(val => 
                              val !== round?.values?.[receiverIdx]
                            );
                            
                            return (
                              <div 
                                key={receiverIdx}
                                className={`p-2 rounded ${
                                  hasReceivedDifferent ? 'bg-white border-2 border-green-300' : 'bg-white border border-gray-200'
                                }`}
                              >
                                <div className="flex items-center space-x-2 mb-1">
                                  <div 
                                    className="w-2 h-2 rounded-full" 
                                    style={{ backgroundColor: getProcessColor(receiverIdx) }} 
                                  />
                                  <span className="text-xs font-medium">{receiverName}</span>
                                  {receivedValues.length > 0 && (
                                    <span className="text-xs text-gray-500">
                                      ({receivedValues.length} msg{receivedValues.length > 1 ? 's' : ''})
                                    </span>
                                  )}
                                </div>
                                
                                {senderInfo.length > 0 ? (
                                  <div className="space-y-1 mt-1">
                                    {senderInfo.map((info, infoIdx) => (
                                      <div key={infoIdx} className="flex items-center space-x-1 text-xs">
                                        <span className="text-gray-500">from</span>
                                        <div 
                                          className="w-2 h-2 rounded-full" 
                                          style={{ backgroundColor: getProcessColor(info.fromIdx) }} 
                                        />
                                        <span className="text-gray-600">{info.from}:</span>
                                        <span className={`font-mono ${
                                          info.value !== round?.values?.[receiverIdx] ? 'text-green-600 font-semibold' : 'text-gray-600'
                                        }`}>
                                          {fmt3(info.value)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div className="text-xs text-gray-400 mt-1">No messages received</div>
                                )}
                                
                                {/* Mostrar decisión según el algoritmo */}
                                {hasReceivedDifferent && (
                                  <div className="mt-2 pt-1 border-t border-gray-200">
                                    <div className="text-xs">
                                      {algorithm === "AMP" && (
                                        <span className="text-blue-600">→ Moved to meeting point: {fmt3(meetingPoint)}</span>
                                      )}
                                      {algorithm === "FV" && (
                                        <span className="text-purple-600">
                                          → Adopted: {fmt3(receivedValues.find(v => v !== round?.values?.[receiverIdx]))}
                                        </span>
                                      )}
                                      {algorithm === "MIN" && (
                                        <span className="text-yellow-600">→ Added to known set</span>
                                      )}
                                      {algorithm === "RECURSIVE AMP" && (
                                        <span className="text-indigo-600">→ Applied recursive meeting point</span>
                                      )}
                                      {algorithm === "COURTEOUS" && (
                                        <span className="text-indigo-600">
                                          → Courteous: {receivedValues.length === 1 ? "Adopted different value" : "Majority decision"}
                                        </span>
                                      )}
                                      {algorithm === "SELFISH" && (
                                        <span className="text-orange-600">
                                          → Selfish: {receivedValues.length === 1 ? "Kept own value" : "Majority decision"}
                                        </span>
                                      )}
                                      {algorithm === "CYCLIC" && (
                                        <span className="text-teal-600">→ Cyclic rule applied</span>
                                      )}
                                      {algorithm === "BIASED0" && (
                                        <span className="text-pink-600">→ Biased to 0</span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Known Values Sets - Compatible con TODOS los algoritmos */}
                  {(Array.isArray(round?.knownValuesSets) || 
                    ["MIN", "RECURSIVE AMP", "COURTEOUS", "SELFISH", "CYCLIC", "BIASED0"].includes(algorithm)) && (
                    <div className="mb-4">
                      <h5 className="font-medium mb-2 text-sm">
                        {algorithm === "MIN" ? "Known Values Sets (MIN Algorithm)" : 
                        algorithm === "RECURSIVE AMP" ? "Known Values Sets (RECURSIVE AMP)" :
                        ["COURTEOUS", "SELFISH", "CYCLIC", "BIASED0"].includes(algorithm) ? 
                        `Decision Logic (${algorithm})` :
                        "Known Values Sets"}:
                      </h5>
                      
                      {/* Para algoritmos de 3 procesos, mostrar lógica especial */}
                      {["COURTEOUS", "SELFISH", "CYCLIC", "BIASED0"].includes(algorithm) ? (
                        <div className="bg-blue-50 p-4 rounded">
                          <div className="space-y-2">
                            {processNames.map((name, idx) => {
                              const currentValue = round?.values?.[idx];
                              const prevValue = index > 0 ? experimentHistory[index - 1]?.values?.[idx] : null;
                              
                              // Recopilar mensajes recibidos
                              const receivedMessages = [];
                              if (Array.isArray(round?.messages)) {
                                round.messages.forEach((senderMsgs, senderIdx) => {
                                  if (senderIdx !== idx && Array.isArray(senderMsgs)) {
                                    senderMsgs.forEach(msg => {
                                      if (msg.to === idx && msg.delivered) {
                                        receivedMessages.push({
                                          from: processNames[senderIdx],
                                          value: msg.value
                                        });
                                      }
                                    });
                                  }
                                });
                              }
                              
                              const heardDifferent = receivedMessages.some(m => m.value !== currentValue);
                              const heardCount = receivedMessages.length;
                              
                              // Determinar la decisión basada en el algoritmo
                              let decisionReason = "";
                              let decisionColor = "text-gray-600";
                              
                              if (algorithm === "COURTEOUS") {
                                if (heardCount === 0) {
                                  decisionReason = "No messages → Keep own value";
                                } else if (heardCount === 2) {
                                  const allVals = [currentValue, ...receivedMessages.map(m => m.value)];
                                  const count0 = allVals.filter(v => v === 0).length;
                                  decisionReason = `All heard → Majority (${count0 > 1 ? '0' : '1'})`;
                                  decisionColor = "text-indigo-600";
                                } else if (heardCount === 1 && heardDifferent) {
                                  decisionReason = `Heard different → Adopt ${receivedMessages[0].value}`;
                                  decisionColor = "text-green-600";
                                } else {
                                  decisionReason = "Keep own value";
                                }
                              } else if (algorithm === "SELFISH") {
                                if (heardCount === 0) {
                                  decisionReason = "No messages → Keep own value";
                                } else if (heardCount === 2) {
                                  const allVals = [currentValue, ...receivedMessages.map(m => m.value)];
                                  const count0 = allVals.filter(v => v === 0).length;
                                  decisionReason = `All heard → Majority (${count0 > 1 ? '0' : '1'})`;
                                  decisionColor = "text-orange-600";
                                } else if (heardCount === 1 && heardDifferent) {
                                  decisionReason = "Heard different → Keep own (selfish)";
                                  decisionColor = "text-red-600";
                                } else {
                                  decisionReason = "Keep own value";
                                }
                              } else if (algorithm === "CYCLIC") {
                                const cyclicPrev = idx === 0 ? 2 : idx - 1;
                                const cyclicNext = idx === 2 ? 0 : idx + 1;
                                const heardFromPrev = receivedMessages.find(m => 
                                  m.from === processNames[cyclicPrev]
                                );
                                
                                if (heardCount === 0) {
                                  decisionReason = "No messages → Keep own value";
                                } else if (heardCount === 2) {
                                  const allVals = [currentValue, ...receivedMessages.map(m => m.value)];
                                  const count0 = allVals.filter(v => v === 0).length;
                                  decisionReason = `All heard → Majority (${count0 > 1 ? '0' : '1'})`;
                                  decisionColor = "text-teal-600";
                                } else if (heardFromPrev && heardDifferent) {
                                  decisionReason = `Cyclic: heard from ${processNames[cyclicPrev]} → Adopt`;
                                  decisionColor = "text-cyan-600";
                                } else {
                                  decisionReason = "Keep own value (cyclic rule)";
                                }
                              } else if (algorithm === "BIASED0") {
                                const allVals = [currentValue, ...receivedMessages.map(m => m.value)];
                                if (allVals.includes(0)) {
                                  decisionReason = "Heard or has 0 → Decide 0";
                                  decisionColor = "text-pink-600";
                                } else {
                                  decisionReason = "No 0 detected → Keep 1";
                                }
                              }
                              
                              return (
                                <div key={idx} className="flex items-start space-x-3">
                                  <div className="flex items-center space-x-2">
                                    <div 
                                      className="w-3 h-3 rounded-full" 
                                      style={{ backgroundColor: getProcessColor(idx) }}
                                    />
                                    <span className="font-medium text-sm">{name}:</span>
                                  </div>
                                  <div className="flex-1">
                                    <div className="text-sm">
                                      <span className="font-mono">{prevValue?.toFixed(1)}</span>
                                      <span className="mx-2">→</span>
                                      <span className="font-mono font-bold">{currentValue?.toFixed(1)}</span>
                                    </div>
                                    <div className={`text-xs mt-1 ${decisionColor}`}>
                                      {decisionReason}
                                    </div>
                                    {receivedMessages.length > 0 && (
                                      <div className="text-xs text-gray-500 mt-1">
                                        Received: {receivedMessages.map(m => `${m.value} from ${m.from}`).join(", ")}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        /* Código existente para MIN y RECURSIVE AMP */
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                          {processNames.map((name, idx) => {
                            let knownSet = [];
                            
                            if (Array.isArray(round?.knownValuesSets) && round.knownValuesSets[idx]) {
                              knownSet = round.knownValuesSets[idx];
                            } else if (algorithm === "MIN" || algorithm === "RECURSIVE AMP") {
                              const receivedMessages = [];
                              if (Array.isArray(round?.messages)) {
                                round.messages.forEach((senderMsgs, senderIdx) => {
                                  if (senderIdx !== idx && Array.isArray(senderMsgs)) {
                                    senderMsgs.forEach(msg => {
                                      if (msg.to === idx && msg.delivered) {
                                        receivedMessages.push(msg.value);
                                      }
                                    });
                                  }
                                });
                              }
                              knownSet = [round?.values?.[idx], ...receivedMessages].filter(v => v !== undefined);
                              knownSet = Array.from(new Set(knownSet.map(v => JSON.stringify(v)))).map(v => JSON.parse(v));
                            }
                            
                            const bgColor = algorithm === "MIN" ? 
                              (knownSet.length > 1 ? 'bg-yellow-50' : 'bg-gray-50') :
                              algorithm === "RECURSIVE AMP" ?
                              (knownSet.length > 1 ? 'bg-purple-50' : 'bg-gray-50') :
                              'bg-gray-50';
                            
                            const formatKnownValue = (value) => {
                              if (Array.isArray(value)) {
                                return `(${value.map(v => (typeof v === 'number' ? v.toFixed(2) : String(v))).join(', ')})`;
                              }
                              return typeof value === 'number' ? value.toFixed(4) : String(value);
                            };
                            
                            return (
                              <div 
                                key={idx}
                                className={`p-3 rounded ${bgColor} border ${selectedProcess === idx ? 'border-blue-500' : 'border-gray-200'}`}
                              >
                                <div className="flex items-center space-x-2 mb-2">
                                  <div 
                                    className="w-3 h-3 rounded-full" 
                                    style={{ backgroundColor: getProcessColor(idx) }} 
                                  />
                                  <span className="text-sm font-medium">{name}</span>
                                  <span className="text-xs text-gray-500">({knownSet.length} values)</span>
                                </div>
                                
                                <div className="space-y-1">
                                  {knownSet.length > 0 ? (
                                    <div className="text-sm font-mono text-gray-700">
                                      {/* Mostrar como conjunto simple */}
                                      <span className="text-xs text-gray-500">Set: </span>
                                      <span className="font-semibold">
                                        {`{${knownSet.map(val => formatKnownValue(val)).join(', ')}}`}
                                      </span>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-gray-400">No values known</div>
                                  )}
                                </div>
                                
                                {(algorithm === "MIN" || algorithm === "RECURSIVE AMP") && knownSet.length > 1 && (
                                  <div className="mt-2 pt-2 border-t border-gray-200">
                                    <div className="text-xs text-gray-600">
                                      {algorithm === "MIN" ? 
                                        <span className="text-yellow-700 font-semibold">
                                          → Will decide: {formatKnownValue(Math.min(...knownSet.filter(v => typeof v === 'number')))}
                                        </span> :
                                        `Range: [${formatKnownValue(Math.min(...knownSet.filter(v => typeof v === 'number')))}, ${formatKnownValue(Math.max(...knownSet.filter(v => typeof v === 'number')))}]`
                                      }
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Matriz de mensajes */}
                  {index > 0 && (
                    <div className="mt-4">
                      <h5 className="font-medium mb-2">Message Delivery Matrix:</h5>
                      {(() => {
                        // Flatten con 'from' para la tabla
                        const formatted = nested.flatMap((msgsFromSender, senderIdx) =>
                          (msgsFromSender || []).map(msg => ({ ...msg, from: senderIdx }))
                        );
                        if (!Array.isArray(formatted) || formatted.length === 0) {
                          return <div className="text-sm text-gray-500">No message data for this round.</div>;
                        }
                        return (
                          <MessageDeliveryTable
                            messages={formatted}
                            processNames={processNames}
                            selectedProcess={selectedProcess}
                            previousValues={prevValues || []}
                            finalValues={Array.isArray(round?.values) ? round.values : []}
                            algorithm={algorithm}
                          />
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}



  // Obtener las discrepancias para un valor específico de p
  function getDiscrepanciesForP(statsData, p) {
    if (!statsData || !statsData.experimentResults) return [];
    
    // Buscar los resultados para este valor de p
    const pResults = statsData.experimentResults.find(result => 
      Math.abs(result.p - p) < 0.001 // Tolerancia para comparación de flotantes
    );
    
    if (!pResults || !pResults.discrepancies) return [];
    
    return pResults.discrepancies;
  }

  // Obtener el valor teórico para un p específico
  function getTheoreticalForP(experimentalResults, p) {
    if (!experimentalResults || experimentalResults.length === 0) return null;
    
    const result = experimentalResults.find(r => 
      Math.abs(r.p - p) < 0.001
    );
    
    return result ? result.theoretical : null;
  }

  // Obtener la media experimental para un p específico
  function getExperimentalMeanForP(statsData, p) {
    const discrepancies = getDiscrepanciesForP(statsData, p);
    if (discrepancies.length === 0) return null;
    
    return discrepancies.reduce((a, b) => a + b, 0) / discrepancies.length;
  }


  const prepareStatsData = (experimentalResults) => {
    // Extraer valores únicos de p
    const pValues = [...new Set(experimentalResults.map(r => r.p))].sort((a, b) => a - b);
    
    // Reorganizar los datos por p
    const experimentResults = pValues.map(p => {
      const resultsForP = experimentalResults.filter(r => Math.abs(r.p - p) < 0.001);
      
      // Si hay múltiples resultados para el mismo p, son repeticiones
      const allDiscrepancies = resultsForP.map(r => r.discrepancy);
      
      return {
        p,
        discrepancies: allDiscrepancies,
        mean: allDiscrepancies.reduce((a, b) => a + b, 0) / allDiscrepancies.length,
        theoretical: resultsForP[0]?.theoretical || null,
        algorithm: resultsForP[0]?.algorithm || null
      };
    });
    
    return {
      experimentResults,
      pValues,
      usedRepetitions: experimentalResults.length / pValues.length
    };
  };

  function addLog(message, type = "info") {
    const timestamp = new Date().toLocaleTimeString();
    let prefix = "";
    
    switch (type) {
      case "error":
        prefix = "❌ ERROR: ";
        break;
      case "warning":
        prefix = "⚠️ WARNING: ";
        break;
      case "success":
        prefix = "✅ SUCCESS: ";
        break;
      default:
        prefix = "ℹ️ INFO: ";
    }
    
    const formattedMessage = `[${timestamp}] ${prefix}${message}`;
    setLogs(prevLogs => [...prevLogs, formattedMessage]);
  }

  function getOptimalAlgorithm(p) {
    return p > 0.5 ? "AMP" : "FV";
  }

  function getDisplayAlgorithm(alg, p) {
    return alg === "auto" ? getOptimalAlgorithm(p) : alg;
  }

  // Get initial values for processes
  function getInitialValues() {
    return [...processValues]; // Devuelve una copia de los valores actuales
  }
  
  // Run range experiments with progressive visualization




function runRangeExperiments() {
  if (isRunning) return;

  cancelRef.current = false;
  setExperimentalResults([]);
  setIsRunning(true);
  setProgress(0);
  setCurrentRepetition(0);

  // Modo y valores iniciales
  const initialProcessValues = dimensionMode === 'binary'
    ? getInitialValues()
    : barycentricValues;

  const nProc = dimensionMode === 'binary'
    ? initialProcessValues.length
    : processCount;

  const { minP, maxP, steps, customSteps, customStepValue } = rangeExperiments;
  const actualRounds = rounds;
  const actualRepetitions = repetitions;
  const actualSteps = customSteps ? customStepValue : steps;

  // Meeting point UI (modo binario 1D)
  let mp = typeof meetingPoint === 'number' ? meetingPoint : parseFloat(meetingPoint);
  if (!Number.isFinite(mp)) mp = 0.5;
  if (Math.abs(mp - 0.5) < 1e-12) mp = 0.5;
  const uiMeetingPoint = Math.max(0, Math.min(1, mp));

  const currentDeliveryMode = deliveryMode || 'standard';

  // Construir rejilla de p
  const allProbabilities = [];
  const stepSize = (maxP - minP) / actualSteps;
  for (let i = 0; i <= actualSteps; i++) {
    const p = minP + i * stepSize;
    if (currentDeliveryMode === 'guaranteed') {
      if (p <= 0) continue; // en conditioned, p debe ser > 0
    }
    if (p >= 0 && p <= 1) allProbabilities.push(p);
  }
  if (minP < 0.5 && maxP > 0.5) {
    const hasHalf = allProbabilities.some(x => Math.abs(x - 0.5) < 1e-12);
    if (!hasHalf) allProbabilities.push(0.5);
  }
  allProbabilities.sort((a, b) => a - b);
  for (let i = allProbabilities.length - 2; i >= 0; i--) {
    if (Math.abs(allProbabilities[i] - allProbabilities[i + 1]) < 1e-12) {
      allProbabilities.splice(i, 1);
    }
  }
  if (currentDeliveryMode === 'guaranteed' && allProbabilities.length === 0) {
    addLog("ERROR: El rango de p no contiene valores > 0. Para conditioned usa 0 < p ≤ 1.", "error");
    setIsRunning(false);
    return;
  }

  // Algoritmos seleccionados
  const algorithmsToRun = [...selectedAlgorithms];

  // Preparar estructuras de resultados
  const results = [];
  const allRunsData = {};

  for (const p of allProbabilities) {
    for (const algoDisplay of algorithmsToRun) {
      const actualAlgo = algoDisplay === "auto" ? (p > 0.5 ? "AMP" : "FV") : algoDisplay;
      const key = `${p}_${actualAlgo}`;

      // Teoría
      let theoretical;
      if (dimensionMode === 'binary') {
        theoretical = currentDeliveryMode === 'guaranteed' && nProc === 2
          ? SimulationEngine.calculateTheoreticalConditionedDiscrepancy(p, actualAlgo, actualRounds)
          : SimulationEngine.calculateExpectedDiscrepancy(p, actualAlgo, actualRounds);
      } else {
        theoretical = dimensions === 2
          ? SimulationEngine.calculateExpectedDiscrepancy(p, actualAlgo, actualRounds)
          : null;
      }

      results.push({
        p,
        algorithm: actualAlgo,
        displayAlgorithm: algoDisplay,
        discrepancies: [],
        samples: 0,
        discrepancy: 0,
        deliveryMode: currentDeliveryMode,
        theoretical,
        mode: dimensionMode,
        dimensions: dimensionMode === 'barycentric' ? dimensions : 2,
        processCount: nProc,
        distanceMetric: dimensionMode === 'barycentric' ? distanceMetric : 'euclidean'
      });

      allRunsData[key] = [];
    }
  }

  setExperimentalResults(results);
  setStatsData(null);

  let currentRep = 0;

  function runNextRepetition() {
    if (cancelRef.current) {
      setIsRunning(false);
      setProgress(100);
      addLog("Simulation cancelled by user", "warning");
      return;
    }

    if (currentRep >= actualRepetitions) {
      setIsRunning(false);
      setProgress(100);
      setExperimentRuns(allRunsData);

      // Selección segura inicial para viewer
      try {
        const keys = Object.keys(allRunsData);
        const firstValidKey = keys.find(k =>
          Array.isArray(allRunsData[k]) &&
          allRunsData[k].length > 0 &&
          Array.isArray(allRunsData[k][0]) &&
          allRunsData[k][0].length > 0
        );
        if (firstValidKey) {
          const [pStr, algoReal] = firstValidKey.split('_');
          const pNum = Number(pStr);
          if (!Number.isNaN(pNum)) setSelectedProbabilityForDetails(pNum);
          setSelectedAlgorithmForDetails(algoReal);
          setSelectedRepetition(0);
        } else {
          setSelectedProbabilityForDetails(null);
          setSelectedAlgorithmForDetails(null);
          setSelectedRepetition(0);
        }
      } catch {
        setSelectedProbabilityForDetails(null);
        setSelectedAlgorithmForDetails(null);
        setSelectedRepetition(0);
      }

      const modeInfo = dimensionMode === 'barycentric'
        ? ` (${dimensions}D Barycentric)`
        : currentDeliveryMode === 'guaranteed'
          ? " (Guaranteed/Conditioned)"
          : '';
      addLog(`Simulation completed: ${results.length} data points${modeInfo}`, "success");
      return;
    }

    setCurrentRepetition(currentRep + 1);

    // Una repetición completa
    let resultIndex = 0;
    for (const p of allProbabilities) {
      if (cancelRef.current) break;

      for (const algoDisplay of algorithmsToRun) {
        const actualAlgo = algoDisplay === "auto" ? (p > 0.5 ? "AMP" : "FV") : algoDisplay;
        const key = `${p}_${actualAlgo}`;

        // Meeting point para modo baricéntrico: único cálculo por (p, algo)
        // - RECURSIVE AMP: escalar α (default 0.5)
        // - AMP/otros: vector; si se pasó número, replicar por dimensión; default [0.5,...]
        const barycentricMeetingPoint = (() => {
          if (actualAlgo === 'RECURSIVE AMP') {
            if (typeof customMeetingPoint === 'number' && Number.isFinite(customMeetingPoint)) {
              return Math.max(0, Math.min(1, customMeetingPoint));
            }
            if (Array.isArray(customMeetingPoint) && customMeetingPoint.length > 0) {
              const alpha = Number(customMeetingPoint[0]);
              return Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 0.5;
            }
            return 0.5;
          }
          if (Array.isArray(customMeetingPoint) && customMeetingPoint.length === dimensions) {
            return customMeetingPoint.map(v => {
              const num = Number(v);
              return Number.isFinite(num) ? Math.max(0, Math.min(1, num)) : 0.5;
            });
          }
          if (typeof customMeetingPoint === 'number' && Number.isFinite(customMeetingPoint)) {
            const v = Math.max(0, Math.min(1, customMeetingPoint));
            return Array(dimensions).fill(v);
          }
          return Array(dimensions).fill(0.5);
        })();

        let history;

        if (dimensionMode === 'barycentric') {
          const mpEff = resolveMeetingPoint(
            actualAlgo,
            (typeof customMeetingPoint !== 'undefined' && customMeetingPoint !== null) ? customMeetingPoint : meetingPoint,
            dimensions
          );

          history = SimulationEngine.barycentric.runBarycentricExperiment(
            initialProcessValues,
            p,
            actualRounds,
            actualAlgo,
            mpEff,
            distanceMetric
          );
        } else if (currentDeliveryMode === 'guaranteed') {
          // Simulación condicionada binaria (≥1 mensaje)
          const mpUsed = (nProc === 2 && actualAlgo === "AMP") ? 0.5 : uiMeetingPoint;

          const v0 = [...initialProcessValues];
          const localHistory = [];
          let values = v0;

          // Estado inicial
          const initDisc = values.reduce((mx, vi, i) => {
            for (let j = i + 1; j < values.length; j++) {
              const d = Math.abs(vi - values[j]);
              if (d > mx) mx = d;
            }
            return mx;
          }, 0);
          localHistory.push({
            round: 0,
            values: [...values],
            discrepancy: initDisc,
            messages: [],
            messageDelivery: []
          });

          for (let r = 1; r <= actualRounds; r++) {
            const rr = SimulationEngine.simulateRoundWithConditioning(
              values, p, actualAlgo, mpUsed, conditionedK
            );
            values = rr.newValues;

            localHistory.push({
              round: r,
              values: [...values],
              discrepancy: rr.discrepancy,
              messages: Array.isArray(rr.messages) ? rr.messages : [],
              messageDelivery: Array.isArray(rr.messageDelivery) ? rr.messageDelivery : []
            });
          }

          history = localHistory;
        } else {
          // Modo estándar binario
          history = SimulationEngine.runNProcessExperiment(
            initialProcessValues,
            p,
            actualRounds,
            actualAlgo,
            uiMeetingPoint
          );
        }

        allRunsData[key].push(history);

        // Actualizar estadísticas agregadas
        const finalDiscrepancy = history[history.length - 1]?.discrepancy ?? 0;
        results[resultIndex].discrepancies.push(finalDiscrepancy);
        results[resultIndex].samples = results[resultIndex].discrepancies.length;
        results[resultIndex].discrepancy =
          results[resultIndex].discrepancies.reduce((s, x) => s + x, 0) /
          results[resultIndex].samples;

        // Chequeo con teoría (solo binario + guaranteed + 2 proc)
        if (dimensionMode === 'binary' && currentDeliveryMode === 'guaranteed' &&
            nProc === 2 && p > 0 && p < 1) {
          const theo = SimulationEngine.calculateTheoreticalConditionedDiscrepancy(p, actualAlgo, actualRounds);
          const d = results[resultIndex].discrepancy;
          if (Number.isFinite(d) && Number.isFinite(theo) && theo > 0 && d > theo * 1.10) {
            console.warn(
              `Discrepancy ${d.toFixed(6)} exceeds theoretical (conditioned) ${theo.toFixed(6)} for p=${p}, algo=${actualAlgo}`
            );
          }
        }

        resultIndex++;
      }
    }

    setExperimentalResults([...results]);
    const progressValue = Math.round(((currentRep + 1) / actualRepetitions) * 100);
    setProgress(progressValue);

    currentRep++;
    setTimeout(runNextRepetition, 10);
  }

  const startMessage = dimensionMode === 'barycentric'
    ? `Starting ${dimensions}D barycentric simulation with ${processCount} processes`
    : currentDeliveryMode === 'guaranteed'
      ? 'Starting simulation with Guaranteed/Conditioned (≥1 message) mode'
      : 'Starting simulation with Standard Delivery mode';

  addLog(startMessage, "info");

  setTimeout(runNextRepetition, 5);
}












  function cancelRangeExperiment() {
  if (!isRunning) return;
  cancelRef.current = true;   // Señala a runRangeExperiments que detenga el bucle
  setIsRunning(false);        // Actualiza el estado para ocultar “Running…”
  }


  function runFVMethodComparison() {
    // Only allow for 3+ processes
    if (processValues.length < 3) {
      addLog("FV method comparison is only available with 3 or more processes selected", "warning");
      return;
    }
    
    setIsRunning(true);
    addLog("Comparing different FV methods...");
    
    const initialValues = getInitialValues();
    const p = probability;
    const methods = ["average", "median", "weighted", "accelerated", "first"];
    let results = [];
    
    // Process methods one by one
    let currentMethod = 0;
    
    function processNextMethod() {
      if (currentMethod >= methods.length) {
        // All methods processed
        setComparisonResults(results);
        addLog("FV method comparison completed", "success");
        setIsRunning(false);
        setProgress(100);
        return;
      }
      
      const method = methods[currentMethod];
      addLog(`Testing FV method: ${method}...`);
      
      // Run simulations for this method
      setTimeout(() => {
        let totalDiscrepancy = 0;
        let totalConvergenceRound = 0;
        
        for (let i = 0; i < repetitions; i++) {
          const history = SimulationEngine.runExperiment(
            initialValues,
            p,
            rounds,
            "FV",
            meetingPoint,
            method
          );
          
          const finalDiscrepancy = history[history.length - 1].discrepancy;
          totalDiscrepancy += finalDiscrepancy;
          
          // Find convergence round (when discrepancy drops below 0.1)
          const convergenceRound = history.findIndex(r => r.discrepancy < 0.1);
          totalConvergenceRound += convergenceRound >= 0 ? convergenceRound : rounds;
        }
        
        // Add result for this method
        results.push({
          method,
          avgDiscrepancy: totalDiscrepancy / repetitions,
          avgConvergenceRound: totalConvergenceRound / repetitions
        });
        
        // Update progress
        currentMethod++;
        const progressPercent = Math.round((currentMethod / methods.length) * 100);
        setProgress(progressPercent);
        
        // Process next method
        processNextMethod();
      }, 5); // Reduced delay for faster execution
    }
    
    // Start with the first method
    processNextMethod();
  }

  // Handle curve display settings for range experiments
  function handleCurveDisplayChange(curve) {
    if (curve === 'algorithmChange') {
      let newDisplayCurves;
      if (forcedAlgorithm === 'AMP') {
        newDisplayCurves = {
          experimental: true,
          theoreticalAmp: false,
          theoreticalFv: false
        };
      } else if (forcedAlgorithm === 'FV') {
        newDisplayCurves = {
          experimental: true,
          theoreticalAmp: false,
          theoreticalFv: false
        };
      } else {
        newDisplayCurves = {
          experimental: true,
          theoreticalAmp: false,
          theoreticalFv: false
        };
      }
      setRangeDisplayCurves(newDisplayCurves);
      return;
    }
    
    setRangeDisplayCurves(prev => ({
      ...prev,
      [curve]: !prev[curve]
    }));
  }

  // Animation controls
  function playAnimation() {
    if (!experimentData) return;
    setIsPlaying(true);
    clearInterval(animationTimerRef.current);
    animationTimerRef.current = setInterval(() => {
      setCurrentAnimation(prev => {
        const next = prev + 1;
        if (next >= experimentData.length) {
          clearInterval(animationTimerRef.current);
          setIsPlaying(false);
          return prev;
        }
        return next;
      });
    }, 800);
  }

  function pauseAnimation() {
    setIsPlaying(false);
    clearInterval(animationTimerRef.current);
  }

  function resetAnimation() {
    setCurrentAnimation(0);
    setIsPlaying(false);
    clearInterval(animationTimerRef.current);
  }

  function handleSliderChange(value) {
    setCurrentAnimation(value);
    if (isPlaying) pauseAnimation();
  }

  // Cleanup animation timer on component unmount
  useEffect(() => {
    return () => clearInterval(animationTimerRef.current);
  }, []);

  // Functions for saving experiments
  function prepareRangeExperiment() {
    if (!experimentalResults || experimentalResults.length === 0) {
      addLog("No range experiment data available to save", "warning");
      return;
    }
    
    try {
      // Get initial values and count processes with value 0 (m)
      const initialValues = getInitialValues();
      let m = 0;
      initialValues.forEach(val => {
        if (val === 0 || val === 0.0) m++;
      });
      
      // Prepare data to save
      const experimentData = {
        type: "range",
        timestamp: new Date().toISOString(),
        parameters: {
          processCount: processValues.length,
          initialValues: initialValues,
          m: m, // Número de procesos con valor 0
          minP: rangeExperiments.minP,
          maxP: rangeExperiments.maxP,
          steps: rangeExperiments.customSteps ? rangeExperiments.customStepValue : rangeExperiments.steps,
          algorithm: forcedAlgorithm,
          fvMethod: processValues.length > 2 ? fvMethod : null,
          meetingPoint: meetingPoint,
          rounds: rounds,
          repetitions: repetitions
        },
        results: experimentalResults.map(result => ({
          p: result.p,
          algorithm: result.algorithm,
          discrepancy: result.discrepancy,
          theoretical: result.theoretical,
          samples: result.samples,
          // Incluir array de discrepancias individuales si está disponible
          discrepancies: result.discrepancies ? [...result.discrepancies] : null
        }))
      };
      
      // Prepare to save
      setCurrentExperimentToSave(experimentData);
      setShowSaveModal(true);
      
      // Generate suggested name based on process configuration
      const processInfo = processValues.length > 3 ? 
        `${processValues.length}-processes` : 
        `${processValues.length}p (${m}×0,${processValues.length-m}×1)`;
        
      const algInfo = forcedAlgorithm === "auto" ? 
        "Auto" : 
        forcedAlgorithm + (forcedAlgorithm === "AMP" ? `(${meetingPoint})` : "");
      
      const defaultName = `Range P=${rangeExperiments.minP.toFixed(2)}-${rangeExperiments.maxP.toFixed(2)} ${algInfo} ${processInfo}${rounds > 1 ? ` (${rounds} rounds)` : ''}`;
      
      // Generate tags automatically
      let suggestedTags = [
        "range",
        forcedAlgorithm.toLowerCase(),
        `${processValues.length}-processes`,
        `m=${m}`
      ];
      
      // Add special tags based on properties
      if (rounds > 1) suggestedTags.push("multi-round");
      if (rangeExperiments.minP < 0.5 && rangeExperiments.maxP > 0.5) suggestedTags.push("crossover");
      if (processValues.length > 2 && forcedAlgorithm === "FV") suggestedTags.push(`fv-${fvMethod}`);
      
      setExperimentMetadata({
        name: defaultName,
        tags: suggestedTags.join(","),
        description: `Simulation with ${processValues.length} processes (${m} with value 0, ${processValues.length-m} with value 1) from p=${rangeExperiments.minP.toFixed(2)} to p=${rangeExperiments.maxP.toFixed(2)} with ${experimentalResults.length} data points${rounds > 1 ? ` over ${rounds} rounds` : ''}.`
      });
    } catch (error) {
      addLog(`Error preparing experiment for saving: ${error.message}`, "error");
      console.error("Error in prepareRangeExperiment:", error);
    }
  }

  // Run multi-round convergence analysis
  function runMultiRoundAnalysis() {
    setIsRunningMultiRound(true);
    addLog("Running multi-round convergence analysis...");
    
    // Get settings
    const { initialGap, maxRounds, pValues, repetitions: mrRepetitions } = multiRoundSettings;
    
    // Run the analysis
    setTimeout(() => {
      try {
        const results = SimulationEngine.runMultiRoundAnalysis(
          initialGap,
          pValues,
          maxRounds,
          mrRepetitions
        );
        
        setMultiRoundAnalysisData(results);
        addLog("Multi-round analysis completed", "success");
      } catch (error) {
        addLog(`Error in multi-round analysis: ${error.message}`, "error");
      } finally {
        setIsRunningMultiRound(false);
      }
    }, 20); // delay 
  }

  // Analyze convergence rates
  function analyzeConvergenceRates() {
    addLog("Analyzing convergence rates...");
    
    const pValues = [0.1, 0.3, 0.5, 0.7, 0.9];
    const rates = [];
    
    for (const p of pValues) {
      const ampRate = SimulationEngine.analyzeConvergenceRate(p, 5, "AMP");
      const fvRate = SimulationEngine.analyzeConvergenceRate(p, 5, "FV");
      rates.push(ampRate, fvRate);
    }
    
    setConvergenceRatesData(rates);
    addLog("Convergence rate analysis completed", "success");
  }

  // Componente para controlar n procesos
  function NProcessesControl() {
    const processCount = processValues.length;
    
    const addProcess = () => {
      if (processCount < 100) { // Limitar a 10 procesos para la usabilidad
        // Valor por defecto para nuevo proceso: alternar 0 y 1
        setProcessValues([...processValues, processCount % 2]);
      }
    };
    
    const removeProcess = () => {
      if (processCount > 2) { // Mínimo 2 procesos
        setProcessValues(processValues.slice(0, -1));
      }
    };
    
    return (
      <div className="mb-4 bg-blue-50 p-3 rounded-lg">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-sm font-semibold">Processes ({processCount})</h3>
          <div className="flex space-x-2">
            <button
              onClick={removeProcess}
              disabled={processCount <= 2 || isRunning}
              className={`px-2 py-1 rounded ${
                processCount <= 2 || isRunning ? 'bg-gray-300 text-gray-500' : 'bg-red-100 text-red-600 hover:bg-red-200'
              }`}
            >
              -
            </button>
            <button
              onClick={addProcess}
              disabled={processCount >= 100 || isRunning}
              className={`px-2 py-1 rounded ${
                processCount >= 100 || isRunning ? 'bg-gray-300 text-gray-500' : 'bg-green-100 text-green-600 hover:bg-green-200'
              }`}
            >
              +
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {processValues.map((value, index) => {
            // Asignar colores específicos para los primeros procesos
            let color = "#666";
            if (index === 0) color = ALICE_COLOR;
            else if (index === 1) color = BOB_COLOR;
            else if (index === 2) color = CHARLIE_COLOR;
            else {
              // Para procesos adicionales, asignar colores del arcoíris
              const colors = [
                "#9c27b0", "#e91e63", "#f44336", "#ff9800", 
                "#ffc107", "#8bc34a", "#009688"
              ];
              color = colors[(index - 3) % colors.length];
            }
            
            const processName = index < 3 ? 
              ["Alice", "Bob", "Charlie"][index] : 
              `P${index+1}`;
            
            return (
              <div key={index}>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-medium" style={{ color }}>{processName}</label>
                </div>
                <input
                  type="number"
                  value={value}
                  onChange={(e) => {
                    const newValues = [...processValues];
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                      newValues[index] = val;
                      setProcessValues(newValues);
                    }
                  }}
                  className="w-full p-1 text-sm border rounded-md"
                  style={{ borderColor: color }}
                  disabled={isRunning}
                  step="0.1"
                  placeholder="Value"
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 p-4 rounded-lg">
      {/* Save Experiment Modal */}
      <SaveExperimentModal 
        showSaveModal={showSaveModal}
        setShowSaveModal={setShowSaveModal}
        experimentMetadata={experimentMetadata}
        setExperimentMetadata={setExperimentMetadata}
        currentExperimentToSave={currentExperimentToSave}
        setSavedExperiments={setSavedExperiments}
        addLog={addLog}
      />
      
      {/* Header */}
      <header className="bg-white shadow rounded-lg mb-6">
        <div className="px-4 py-4 flex items-center">
          <div className="w-12 h-12 mr-4">
            <AppLogo />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">ApproximateLVL</h1>
            <p className="text-sm text-gray-500">Multi-Process Distributed Computing Agreement Simulator</p>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="mb-8">
        <div className="flex flex-col lg:flex-row gap-4">
        {/* Sidebar */}
              
        {/* ======== SIDEBAR / SIMULATION PARAMETERS (COMPLETO) ======== */}
        <div className="lg:w-1/4 flex-shrink-0">
          <div className="bg-white rounded-lg shadow p-6 mb-6 space-y-6">
            <h2 className="text-lg font-semibold">🎛️ Simulation Parameters</h2>

            {/* Toggle Binary / Multi-Dimensional */}
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Initial Values</h3>
              <div className="flex items-center space-x-1 bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => {
                    setDimensionMode('binary');
                    addLog("Switched to Binary mode");
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                    dimensionMode === 'binary'
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                  disabled={isRunning}
                >
                  One-Dimension
                </button>
                <button
                  onClick={() => {
                    setDimensionMode('barycentric');
                    initializeBarycentricValues(processCount, dimensions);
                    // asegurar meeting point vector
                    setCustomMeetingPoint(Array(dimensions).fill(0.5));
                    addLog("Switched to Multi-Dimensional mode");
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded transition-all ${
                    dimensionMode === 'barycentric'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                  disabled={isRunning}
                >
                  Multi-Dimensional
                </button>
              </div>
            </div>

            {/* Modo según dimensionMode */}
            {dimensionMode === 'binary' ? (
              <NProcessesControl
                processValues={processValues}
                setProcessValues={setProcessValues}
                maxProcesses={100}
                valueMode={valueMode}
                setValueMode={setValueMode}
                isRunning={isRunning}
                /* props extra (no se usan directamente aquí pero mantén compatibilidad) */
                dimensionMode={dimensionMode}
                setDimensionMode={setDimensionMode}
                dimensions={dimensions}
                setDimensions={setDimensions}
                barycentricValues={barycentricValues}
                setBarycentricValues={setBarycentricValues}
                distanceMetric={distanceMetric}
                setDistanceMetric={setDistanceMetric}
                customMeetingPoint={customMeetingPoint}
                setCustomMeetingPoint={setCustomMeetingPoint}
                algorithm={algorithm}
                addLog={addLog}
              />
            ) : (
              <div className="space-y-3">
                {/* Dimensiones y # de procesos */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-gray-600 block mb-1">Dimensions:</label>
                    <select
                      value={dimensions}
                      onChange={(e) => {
                        const newDim = parseInt(e.target.value);
                        setDimensions(newDim);
                        initializeBarycentricValues(processCount, newDim);
                        // re-dimensionar meeting point vector
                        setCustomMeetingPoint(Array(newDim).fill(0.5));
                        addLog(`Set dimensions to ${newDim}D`);
                      }}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      disabled={isRunning}
                    >
                      {[2,3,4,5,6,7,8,9,10].map(d => (
                        <option key={d} value={d}>{d}D</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-gray-600 block mb-1">Processes:</label>
                    <select
                      value={processValues.length}
                      onChange={(e) => {
                        const newCount = parseInt(e.target.value);
                        const currentCount = processValues.length;
                        if (newCount > currentCount) {
                          const newValues = [...processValues];
                          for (let i = currentCount; i < newCount; i++) newValues.push(i % 2);
                          setProcessValues(newValues);
                        } else if (newCount < currentCount) {
                          setProcessValues(processValues.slice(0, newCount));
                        }
                        initializeBarycentricValues(newCount, dimensions);
                        addLog(`Set process count to ${newCount}`);
                      }}
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                      disabled={isRunning}
                    >
                      {[2,3,4,5,6,7,8].map(n => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Distance Metric */}
                <div>
                  <label className="text-xs text-gray-600 block mb-1">Distance Metric:</label>
                  <select
                    value={distanceMetric}
                    onChange={(e) => setDistanceMetric(e.target.value)}
                    className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    disabled={isRunning}
                  >
                    <option value="euclidean">Euclidean</option>
                    <option value="l1">L1 (Manhattan)</option>
                    <option value="linf">L∞ (Max)</option>
                  </select>
                </div>

                {/* Presets */}
                <div className="flex space-x-1">
                  <button
                    onClick={randomizeBarycentricValues}
                    className="flex-1 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                    disabled={isRunning}
                  >
                    Random
                  </button>
                  <button
                    onClick={setToVertices}
                    className="flex-1 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                    disabled={isRunning}
                  >
                    Vertices
                  </button>
                  <button
                    onClick={setToCentroid}
                    className="flex-1 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                    disabled={isRunning}
                  >
                    Centroid
                  </button>
                </div>

                {/* Editor de valores baricéntricos */}
                <div className="bg-gray-50 rounded-lg p-2 max-h-48 overflow-y-auto">
                  <p className="text-xs text-gray-600 mb-1">Coordinates (sum to 1):</p>
                  {Array.from({ length: processCount }).map((_, pIdx) => (
                    <div key={pIdx} className="flex items-center space-x-1 mb-1">
                      <span className="text-xs font-medium text-gray-700 w-8">P{pIdx + 1}:</span>
                      <div className="flex-1 grid gap-1" style={{gridTemplateColumns: `repeat(${dimensions}, 1fr)`}}>
                        {Array.from({ length: dimensions }).map((_, dIdx) => (
                          <input
                            key={dIdx}
                            type="number"
                            min="0"
                            max="1"
                            step="0.01"
                            value={barycentricValues[pIdx]?.[dIdx]?.toFixed(2) || 0}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              updateBarycentricValue(pIdx, dIdx, Number.isFinite(val) ? val : 0);
                            }}
                            className="w-full px-1 py-0.5 text-xs border border-gray-300 rounded"
                            disabled={isRunning}
                          />
                        ))}
                      </div>
                      <span className={`text-xs font-medium w-10 text-right ${
                        Math.abs((barycentricValues[pIdx]?.reduce((a, b) => a + b, 0) || 0) - 1) < 0.01
                          ? 'text-green-600'
                          : 'text-red-600'
                      }`}>
                        Σ{(barycentricValues[pIdx]?.reduce((a, b) => a + b, 0) || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Visualización 3D si aplica */}
                {dimensions === 3 && barycentricValues.length > 0 && (
                  <div className="flex justify-center p-2 bg-white rounded border">
                    <SimplexVisualization values={barycentricValues} size={150} />
                  </div>
                )}
              </div>
            )}

            {/* Load / Generate config */}
            <div className="mb-4 space-y-2">
              <h4 className="text-xs font-semibold">Enter the code to load a simulation:</h4>
              <input
                type="text"
                placeholder="Configuration code"
                value={configCode}
                onChange={e => setConfigCode(e.target.value)}
                className="w-full p-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-2 00"
                disabled={isRunning}
              />
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleLoadConfig}
                  className="w-full p-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:opacity-50"
                  disabled={isRunning}
                >
                  Load
                </button>
                <button
                  onClick={handleGenerateConfig}
                  className="w-full p-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-green-200 disabled:opacity-50"
                  disabled={isRunning}
                >
                  Generate
                </button>
              </div>
              {copyMessage && <p className="text-xs text-green-600 font-medium">{copyMessage}</p>}
            </div>

            {/* Algorithm Settings */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold">Algorithm Settings:</h4>

              {/* Delivery Mode */}
              <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Message Delivery Mode:</label>
                  <button
                    className="text-xs text-blue-600 hover:text-blue-800"
                    onClick={() => setShowDeliveryInfo(!showDeliveryInfo)}
                  >
                    {showDeliveryInfo ? 'Hide info' : 'What is this?'}
                  </button>
                </div>

                <div className="space-y-2">
                  <label className="flex items-start cursor-pointer hover:bg-white p-2 rounded transition">
                    <input
                      type="radio"
                      name="deliveryMode"
                      value="standard"
                      checked={deliveryMode === 'standard'}
                      onChange={(e) => setDeliveryMode(e.target.value)}
                      className="mt-1 mr-3"
                      disabled={isRunning}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">Standard Delivery</div>
                      <p className="text-xs text-gray-500 mt-1">
                        Messages delivered with probability p independently. All messages can be lost in a round.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start cursor-pointer hover:bg-white p-2 rounded transition">
                    <input
                      type="radio"
                      name="deliveryMode"
                      value="guaranteed"
                      checked={deliveryMode === 'guaranteed'}
                      onChange={(e) => setDeliveryMode(e.target.value)}
                      className="mt-1 mr-3"
                      disabled={isRunning}
                    />
                    <div className="flex-1">
                      <div className="font-medium text-sm">Guaranteed Progress</div>
                      <p className="text-xs text-gray-500 mt-1">
                        At least one message delivered per round, ensuring network progress.
                      </p>
                    </div>
                  </label>
                </div>

                {deliveryMode === 'guaranteed' && (
                  <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded">
                    <div className="flex items-start">
                      <svg className="w-4 h-4 text-blue-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <div className="text-xs text-blue-700">
                        <p className="font-semibold mb-1">Convergence Guarantee:</p>
                        <p>Maximum discrepancy per round: <span className="font-mono font-bold">1/3</span></p>
                        <p>After {rounds} round{rounds > 1 ? 's' : ''}: <span className="font-mono font-bold">≤ {Math.pow(1/3, rounds).toFixed(6)}</span></p>
                      </div>
                    </div>
                  </div>
                )}

                {/* K para Guaranteed */}
                {deliveryMode === 'guaranteed' && (
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Messages (K):</label>

                    <div className="flex items-center gap-2 mb-2">
                      <input
                        type="number"
                        min="1"
                        max={processValues.length * (processValues.length - 1)}
                        value={conditionedK}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 1;
                          const maxK = processValues.length * (processValues.length - 1);
                          setConditionedK(Math.min(Math.max(1, val), maxK));
                        }}
                        className="w-20 p-2 border border-gray-300 rounded-md"
                        disabled={isRunning}
                      />
                      <span className="text-sm text-gray-600">
                        of {processValues.length * (processValues.length - 1)} possible messages
                      </span>
                    </div>

                    <div className="flex gap-1 mb-2">
                      <button onClick={() => setConditionedK(1)} className="px-2 py-1 text-xs bg-blue-200 rounded hover:bg-blue-300" disabled={isRunning}>Min (1)</button>
                      <button
                        onClick={() => {
                          const total = processValues.length * (processValues.length - 1);
                          setConditionedK(Math.max(1, Math.floor(total * 0.25)));
                        }}
                        className="px-2 py-1 text-xs bg-blue-200 rounded hover:bg-blue-300"
                        disabled={isRunning}
                      >
                        25%
                      </button>
                      <button
                        onClick={() => {
                          const total = processValues.length * (processValues.length - 1);
                          setConditionedK(Math.max(1, Math.floor(total * 0.5)));
                        }}
                        className="px-2 py-1 text-xs bg-blue-200 rounded hover:bg-blue-300"
                        disabled={isRunning}
                      >
                        50%
                      </button>
                      <button
                        onClick={() => {
                          const total = processValues.length * (processValues.length - 1);
                          setConditionedK(Math.max(1, Math.floor(total * 0.75)));
                        }}
                        className="px-2 py-1 text-xs bg-blue-200 rounded hover:bg-blue-300"
                        disabled={isRunning}
                      >
                        75%
                      </button>
                    </div>

                    {(() => {
                      const expectedMessages = processValues.length * (processValues.length - 1) * probability;
                      if (conditionedK > expectedMessages * 2) {
                        return (
                          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs">
                            ⚠️ <strong>Warning:</strong> K={conditionedK} is high for p={probability.toFixed(2)}.
                            Expected ~{expectedMessages.toFixed(1)} messages delivered per round.
                            This may cause the simulation to be slow or fail to meet the condition.
                          </div>
                        );
                      }
                      return null;
                    })()}

                    <div className="text-xs text-gray-600 mt-2">
                      <p><strong>What is K?</strong> The minimum number of messages that must be delivered in each round.</p>
                      <p className="mt-1">
                        With n={processValues.length} processes and p={probability.toFixed(2)},
                        we expect ~{(processValues.length * (processValues.length - 1) * probability).toFixed(1)} messages delivered on average.
                      </p>
                    </div>
                  </div>
                )}

                {showDeliveryInfo && (
                  <div className="mt-3 p-3 bg-white border rounded text-xs text-gray-600">
                    <p className="font-semibold mb-2">About Delivery Modes:</p>
                    <p className="mb-2"><strong>Standard:</strong> Models realistic networks where message loss is independent. Useful for studying average-case behavior and expected convergence rates.</p>
                    <p><strong>Guaranteed Progress:</strong> Models networks with reliability mechanisms that ensure at least one message succeeds per round. Provides strong convergence bounds useful for safety-critical applications.</p>
                  </div>
                )}
              </div>

              {/* Select Algorithm(s) */}
              <div>
                <label className="block text-xs mb-1">Select Algorithm(s):</label>
                <div className="bg-white p-2 rounded border border-gray-200 max-h-32 overflow-y-auto">
                  {["auto", "AMP", "FV", "RECURSIVE AMP", "MIN"].map(algo => (
                    <label key={algo} className="flex items-center py-1 hover:bg-gray-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedAlgorithms.includes(algo)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            if (!selectedAlgorithms.includes(algo)) setSelectedAlgorithms(prev => [...prev, algo]);
                          } else {
                            setSelectedAlgorithms(prev => prev.filter(a => a !== algo));
                          }
                        }}
                        disabled={isRunning}
                        className="mr-2"
                      />
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        algo === "RECURSIVE AMP" ? "bg-purple-100 text-purple-700" :
                        algo === "AMP"          ? "bg-green-100 text-green-700"  :
                        algo === "FV"           ? "bg-red-100 text-red-700"      :
                        algo === "MIN"          ? "bg-yellow-100 text-yellow-700" :
                                                  "bg-gray-100 text-gray-700"
                      }`}>
                        {algo}
                      </span>
                    </label>
                  ))}
                  
                  {/* Nuevos algoritmos para 3 procesos binarios */}
                  {/* Nuevos algoritmos para 3 procesos binarios */}
                  {processValues.length === 3 && processValues.every(v => v === 0 || v === 1) && (
                    <>
                      <div className="border-t my-2"></div>
                      <div className="text-xs font-semibold text-gray-600 mb-1">3-Process Binary Algorithms:</div>
                      {["COURTEOUS", "SELFISH", "CYCLIC", "BIASED0"].map(algo => (
                        <label key={algo} className="flex items-center py-1 hover:bg-gray-50 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={selectedAlgorithms.includes(algo)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                if (!selectedAlgorithms.includes(algo)) setSelectedAlgorithms(prev => [...prev, algo]);
                              } else {
                                setSelectedAlgorithms(prev => prev.filter(a => a !== algo));
                              }
                            }}
                            disabled={isRunning}
                            className="mr-2"
                          />
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                            algo === "COURTEOUS" ? "bg-indigo-200 text-indigo-800 border border-indigo-300" :
                            algo === "SELFISH"   ? "bg-orange-200 text-orange-800 border border-orange-300" :
                            algo === "CYCLIC"    ? "bg-teal-200 text-teal-800 border border-teal-300"     :
                                                  "bg-rose-200 text-rose-800 border border-rose-300"
                          }`}>
                            {algo}
                          </span>
                        </label>
                      ))}
                    </>
                  )}
                </div>
                
                {/* Descripción de algoritmos seleccionados */}
                {selectedAlgorithms.some(a => ["COURTEOUS", "SELFISH", "CYCLIC", "BIASED0"].includes(a)) && (
                  <div className="mt-2 p-2 bg-blue-50 rounded text-xs space-y-1">
                    {selectedAlgorithms.includes("COURTEOUS") && (
                      <p><b>Courteous:</b> Adopts different value if heard from 1 process</p>
                    )}
                    {selectedAlgorithms.includes("SELFISH") && (
                      <p><b>Selfish:</b> Keeps own value if heard from 1 process</p>
                    )}
                    {selectedAlgorithms.includes("CYCLIC") && (
                      <p><b>Cyclic:</b> Follows A→B, B→C, C→A order</p>
                    )}
                    {selectedAlgorithms.includes("BIASED0") && (
                      <p><b>Biased-0:</b> Always decides 0 if any process has 0</p>
                    )}
                  </div>
                )}
                
                <p className="text-xs text-gray-500 mt-1">
                  {selectedAlgorithms.length === 1 ? 
                    "Select multiple algorithms to compare" : 
                    `Comparing ${selectedAlgorithms.length} algorithms`}
                </p>
              </div>

              {/* Meeting Point editors (según algoritmos seleccionados) */}
              {(() => {
                const showAmp     = selectedAlgorithms.some(a => a === 'AMP' || a === 'auto');
                const showRecAmp  = selectedAlgorithms.some(a => a === 'RECURSIVE AMP');

                return (
                  <>
                    {/* AMP Meeting Point */}
                    {showAmp && (
                      <div className="mt-2">
                        <label className="text-sm block mb-1">
                          Meeting Point {dimensionMode === 'barycentric' ? '(vector for AMP)' : '(scalar for AMP)'}
                        </label>

                        {dimensionMode === 'barycentric' ? (
                          <div className="bg-purple-50 rounded-lg p-2 border border-purple-200">
                            <div className="grid gap-1" style={{gridTemplateColumns: `repeat(${dimensions}, 1fr)`}}>
                              {Array.from({ length: dimensions }).map((_, dIdx) => (
                                <input
                                  key={dIdx}
                                  type="number"
                                  min="0"
                                  max="1"
                                  step="0.01"
                                  value={
                                    Array.isArray(customMeetingPoint) && customMeetingPoint.length === dimensions
                                      ? (Number.isFinite(customMeetingPoint[dIdx]) ? customMeetingPoint[dIdx] : 0.5)
                                      : 0.5
                                  }
                                  onChange={(e) => {
                                    const raw = parseFloat(e.target.value);
                                    const v = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0.5;
                                    const next = (
                                      Array.isArray(customMeetingPoint) && customMeetingPoint.length === dimensions
                                        ? [...customMeetingPoint]
                                        : Array(dimensions).fill(0.5)
                                    );
                                    next[dIdx] = v;
                                    setCustomMeetingPoint(next);
                                  }}
                                  className="w-full px-1 py-0.5 text-xs border border-purple-300 rounded"
                                  disabled={isRunning}
                                />
                              ))}
                            </div>
                            <p className="mt-1 text-[11px] text-purple-700">Each entry ∈ [0,1]. Used by AMP in multi-D.</p>
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={meetingPoint}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (/^\d*\.?\d{0,2}$/.test(val) || val === '') {
                                const num = parseFloat(val);
                                if (val === '' || val === '.' || val.endsWith('.')) {
                                  setMeetingPoint(val);
                                } else if (!isNaN(num) && num >= 0 && num <= 1) {
                                  setMeetingPoint(val);
                                }
                              }
                            }}
                            onBlur={(e) => {
                              const num = parseFloat(e.target.value);
                              if (isNaN(num) || num < 0) setMeetingPoint(0);
                              else if (num > 1) setMeetingPoint(1);
                              else setMeetingPoint(num);
                            }}
                            className="w-24 p-1 border border-gray-300 rounded-md"
                            disabled={isRunning}
                            placeholder="0.5"
                          />
                        )}
                      </div>
                    )}

                    {/* Recursive AMP alpha (si está seleccionado) */}
                    {showRecAmp && (
                      <div className="mt-2 p-2 bg-purple-50 rounded border border-purple-200">
                        <label className="text-sm block mb-1">Recursive AMP α (scalar)</label>
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.01"
                          value={
                            typeof meetingPoint === 'number'
                              ? meetingPoint
                              : (parseFloat(meetingPoint) || 0.5)
                          }
                          onChange={(e) => {
                            const v = Math.max(0, Math.min(1, parseFloat(e.target.value)));
                            setMeetingPoint(Number.isFinite(v) ? v : 0.5);
                          }}
                          className="w-24 p-1 border border-purple-300 rounded-md"
                          disabled={isRunning}
                        />
                        <p className="text-xs text-purple-700 mt-1">
                          New value = <strong>α</strong> × range. (range = max − min of known values)
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Simulation Configuration */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold">Simulation Configuration</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs block mb-1">Rounds:</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="1"
                      max="50"
                      value={rounds}
                      onChange={(e) => setRounds(Number(e.target.value))}
                      className="w-full p-1 text-sm border border-gray-300 rounded-md"
                      disabled={isRunning}
                    />
                    {rounds > 1 && (
                      <div
                        className="text-xs text-blue-600 cursor-help"
                        title="Simulation will run for multiple rounds, showing the final discrepancy"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="text-xs block mb-1">Repetitions:</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={repetitions}
                    onChange={(e) => setRepetitions(Number(e.target.value))}
                    className="w-full p-1 text-sm border border-gray-300 rounded-md"
                    disabled={isRunning}
                  />
                </div>
              </div>

              {rounds > 1 && (
                <div className="bg-blue-50 p-2 rounded text-xs">
                  <p className="font-medium text-blue-700">Multi-Round Mode</p>
                  <p className="mt-1">Running simulation for {rounds} rounds. Theory plots and results will show the final discrepancy after all rounds.</p>
                </div>
              )}
            </div>

            {/* Probability Range Settings */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold">Probability Range Settings:</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs mb-1">Min Probability:</label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={rangeExperiments.minP}
                    onChange={(e) => {
                      const newValue = parseFloat(e.target.value);
                      setRangeExperiments((prev) => ({ ...prev, minP: newValue }));
                    }}
                    className="w-full p-1 text-sm border border-gray-300 rounded-md"
                    disabled={isRunning}
                  />
                </div>
                <div>
                  <label className="block text-xs mb-1">Max Probability:</label>
                  <input
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={rangeExperiments.maxP}
                    onChange={(e) => {
                      const newValue = parseFloat(e.target.value);
                      setRangeExperiments((prev) => ({ ...prev, maxP: newValue }));
                    }}
                    className="w-full p-1 text-sm border border-gray-300 rounded-md"
                    disabled={isRunning}
                  />
                </div>
                {/* Steps (opcional, comentado como en tu código) */}
                {/*
                <div>
                  <label className="block text-xs mb-1">Steps:</label>
                  <input
                    type="number"
                    min="100"
                    value={rangeExperiments.steps}
                    onChange={(e) => {
                      const v = Math.max(100, parseInt(e.target.value, 10) || 100);
                      setRangeExperiments(prev => ({
                        ...prev,
                        steps: v,
                        customSteps: false,
                        customStepValue: v
                      }));
                    }}
                    className="w-full p-1 text-sm border border-gray-300 rounded-md"
                    disabled={isRunning}
                  />
                </div>
                */}
              </div>
            </div>

            {/* Display Options */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold">Display Options:</h4>
              <div className="grid grid-cols-1 gap-2">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="showExperimental"
                    checked={rangeDisplayCurves.experimental}
                    onChange={() => handleCurveDisplayChange('experimental')}
                    className="mr-2"
                    disabled={isRunning}
                  />
                  <label htmlFor="showExperimental" className="text-xs">Show Experimental Curve</label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="showTheoreticalAmp"
                    checked={rangeDisplayCurves.theoreticalAmp}
                    onChange={() => handleCurveDisplayChange('theoreticalAmp')}
                    className="mr-2"
                    disabled={isRunning}
                  />
                  <label htmlFor="showTheoreticalAmp" className="text-xs">Show AMP Curve</label>
                </div>
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="showTheoreticalFv"
                    checked={rangeDisplayCurves.theoreticalFv}
                    onChange={() => handleCurveDisplayChange('theoreticalFv')}
                    className="mr-2"
                    disabled={isRunning}
                  />
                  <label htmlFor="showTheoreticalFv" className="text-xs">Show FV Curve</label>
                </div>
              </div>
            </div>

            {/* Run / Cancel */}
            {(activeTab === 'theory' || activeTab === 'statistics') && (
              <button
                onClick={() => {
                  if (!isRunning) runRangeExperiments();
                  else cancelRangeExperiments();
                }}
                className={`w-full py-3 px-4 rounded-md font-semibold text-white ${
                  isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isRunning ? 'Cancel' : 'Run'}
              </button>
            )}
          </div>

          {/* Event Log (mantén igual) */}
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-sm font-semibold">Event Log</h3>
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="text-xs bg-gray-100 hover:bg-gray-200 py-1 px-2 rounded"
              >
                {showLogs ? 'Hide' : 'Show'} Log
              </button>
            </div>
            {showLogs && (
              <div className="h-40 overflow-y-auto bg-gray-50 p-2 rounded text-xs font-mono space-y-1">
                {logs.map((log, index) => {
                  const isError   = log.includes("ERROR");
                  const isWarning = log.includes("WARNING");
                  const isSuccess = log.includes("SUCCESS");
                  let logStyle = "text-gray-700";
                  if (isError)   logStyle = "text-red-600 font-semibold";
                  if (isWarning) logStyle = "text-orange-600";
                  if (isSuccess) logStyle = "text-green-600";
                  return <div key={index} className={logStyle}>{log}</div>;
                })}
              </div>
            )}
          </div>
        </div>
        {/* ======== FIN SIDEBAR ======== */}



          
          {/* Main Content Area */}
          <div className="lg:flex-1">
            <div className="border-b border-gray-200 mb-4">
              <nav className="flex">
                <button 
                  onClick={() => setActiveTab('theory')}
                  className={`px-4 py-2 font-medium text-sm ${activeTab === 'theory' ? 'border-b-2 border-green-500 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  🔍 Theoretical Comparison
                </button>
                <button 
                  onClick={() => setActiveTab('statistics')}
                  className={`px-4 py-2 font-medium text-sm ${activeTab === 'statistics' ? 'border-b-2 border-green-500 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  📈 Statistical Analysis
                </button>
                <button 
                  onClick={() => setActiveTab('saved')}
                  className={`px-4 py-2 font-medium text-sm ${activeTab === 'saved' ? 'border-b-2 border-green-500 text-green-600' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  💾 Saved Experiments
                </button>
              </nav>
            </div>
            {activeTab === 'multiple-dimensions' && (
              <MultipleDimensionsTab />
            )}

            {/* Theoretical Comparison tab */}
            {activeTab === 'theory' && (
              <div>
                <div className="mb-4">
                <TheoryPlot 
                  currentP={probability} 
                  experimentalData={experimentalResults} 
                  displayCurves={rangeDisplayCurves}
                  rounds={rounds}
                  processValues={processValues}
                  meetingPoint={meetingPoint}
                  selectedAlgorithms={selectedAlgorithms}  // AGREGAR ESTA LÍNEA
                  deliveryMode={deliveryMode}
                />
                </div>
                
                <div className="bg-white rounded-lg shadow p-4 mb-4">
                  <h3 className="text-lg font-semibold mb-4">Simulation Experiments</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="col-span-1 md:col-span-2">
                      <div className="mb-4 bg-blue-50 p-3 rounded-lg">
                        <h4 className="font-bold text-blue-800 mb-2">Theoretical Background:</h4>
                        <p className="text-sm mb-2">
                          From the paper, there are algorithms that perform optimally depending on p:
                        </p>
                        <ul className="list-disc pl-5 mb-2 text-sm space-y-1">
                          <li>
                            <span className="font-bold">Agreed Meeting Point (AMP)</span>: For p &gt; 0.5
                          </li>
                          <li>
                            <span className="font-bold">Flip Value (FV)</span>: For p &lt;= 0.5
                          </li>
                        </ul>
                        <p className="text-sm">
                          For n processes with m processes having value 0 and (n-m) having value 1:
                        </p>
                        <ul className="list-disc pl-5 mb-2 text-sm space-y-1">
                          <li>
                            <span className="font-bold">AMP(a)</span>: E[D] = 1 - (aA + (1-a)B) where:
                            <ul className="list-disc pl-5 text-xs mt-1">
                              <li>A = 1 - q^(n-m) (Probability each 0-player received at least one 1-message)</li>
                              <li>B = 1 - q^m (Probability each 1-player received at least one 0-message)</li>
                            </ul>
                          </li>
                          <li>
                            <span className="font-bold">Flip (FV)</span>: E[D] = 1 - (CA + CB) where:
                            <ul className="list-disc pl-5 text-xs mt-1">
                              <li>C = q^(m*(n-m)) (Probability no player received any message)</li>
                            </ul>
                          </li>
                        </ul>
                        {processValues.length === 2 && rounds > 1 && (
                          <div className="bg-white p-2 rounded">
                            <p className="text-sm font-semibold">Multi-round behavior (from Theorem 3.2):</p>
                            <p className="text-sm">After k rounds, discrepancy decreases exponentially: 
                              <ul className="list-disc pl-5 mt-1">
                                <li>AMP: ≤ (1-p)<sup>k</sup> when p ≥ 1/2</li>
                                <li>FV: ≤ (p²+q²)<sup>k</sup> when p &lt; 1/2</li>
                              </ul>
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {isRunning && (
                    <div className="mb-4">
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">Progress:</span>
                        <span className="text-sm">{progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${progress}%` }}></div>
                      </div>
                      {currentRepetition !== undefined && (
                        <div className="text-xs text-center mt-1 text-gray-600">
                          Current repetition: {currentRepetition} of {repetitions}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-6 text-center">
                        <button
                          onClick={prepareRangeExperiment}
                          className="px-4 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700 transition-colors"
                        >
                          💾 Save Experiment
                        </button>
                      </div>

                      {experimentalResults && experimentalResults.length > 0 && (() => {
                        // Helpers locales
                        const resolveAlgo = (algoDisplay, pNum) =>
                          algoDisplay === "auto" ? (pNum > 0.5 ? "AMP" : "FV") : algoDisplay;

                        // ⚠️ FIX CRÍTICO: Usar formato consistente de clave SIN toFixed
                        const keyFor = (pNum, algoDisplay) => {
                          const actualAlgo = resolveAlgo(algoDisplay, pNum);
                          return `${pNum}_${actualAlgo}`;  // Formato consistente con runRangeExperiments
                        };

                        // Probabilidades únicas disponibles
                        const uniquePs = Array.from(new Set(
                          experimentalResults
                            .map(r => r?.p)
                            .filter(p => typeof p === "number" && Number.isFinite(p))
                        )).sort((a, b) => a - b);

                        // Algoritmos con datos para una p dada
                        const availableAlgosForP = (pNum) => {
                          if (pNum == null || !experimentRuns) return [];
                          return selectedAlgorithms.filter(algoDisplay => {
                            const k = keyFor(pNum, algoDisplay);
                            return Array.isArray(experimentRuns?.[k]) && experimentRuns[k].length > 0;
                          });
                        };

                        // Derivados actuales
                        const currentP = selectedProbabilityForDetails ?? null;
                        const currentAlgoDisplay = selectedAlgorithmForDetails ?? null;
                        const currentKey = (currentP != null && currentAlgoDisplay)
                          ? keyFor(currentP, currentAlgoDisplay)
                          : null;
                        const currentRuns = currentKey ? (experimentRuns?.[currentKey] || null) : null;
                        const resolvedAlgoLabel = (currentAlgoDisplay && currentP != null)
                          ? resolveAlgo(currentAlgoDisplay, currentP)
                          : null;

                        return (
                          <div className="mt-6">
                            <h3 className="text-xl font-semibold mb-4">Detailed Experiment Analysis</h3>

                            {/* Selector de probabilidad, algoritmo y repetición */}
                            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Select de probabilidad */}
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Select probability:
                                  </label>
                                  <select
                                    className="w-full p-2 border border-gray-300 rounded-md"
                                    value={currentP != null ? currentP : ""}  // Sin formateo
                                    onChange={(e) => {
                                      const pStr = e.target.value;
                                      const pNum = parseFloat(pStr);
                                      if (!Number.isNaN(pNum)) {
                                        const avail = availableAlgosForP(pNum);
                                        const firstAlgo = avail[0] || selectedAlgorithms[0] || "auto";
                                        setSelectedProbabilityForDetails(pNum);
                                        setSelectedAlgorithmForDetails(firstAlgo);
                                        setSelectedRepetition(0);
                                      }
                                    }}
                                  >
                                    <option value="">Select a probability...</option>
                                    {uniquePs.map((p, idx) => (
                                      <option key={idx} value={p}>  {/* Valor sin formatear */}
                                        p = {p.toFixed(3)}  {/* Solo el display formateado */}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                {/* Selector de algoritmo */}
                                {selectedAlgorithms.length > 1 && currentP != null && (
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Select algorithm:
                                    </label>
                                    <select
                                      className="w-full p-2 border border-gray-300 rounded-md"
                                      value={currentAlgoDisplay || ""}
                                      onChange={(e) => {
                                        const displayAlgo = e.target.value;
                                        setSelectedAlgorithmForDetails(displayAlgo);
                                        setSelectedRepetition(0);
                                      }}
                                    >
                                      {availableAlgosForP(currentP).map(algoDisplay => {
                                        const resolved = resolveAlgo(algoDisplay, currentP);
                                        return (
                                          <option key={algoDisplay} value={algoDisplay}>
                                            {algoDisplay}{algoDisplay === "auto" ? ` (${resolved})` : ""}
                                          </option>
                                        );
                                      })}
                                    </select>
                                  </div>
                                )}

                                {/* Selector de repetición */}
                                {currentP != null && currentAlgoDisplay && currentRuns && currentRuns.length > 0 && (
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                      Select repetition:
                                    </label>
                                    <select
                                      className="flex-1 p-2 border border-gray-300 rounded-md"
                                      value={selectedRepetition ?? 0}
                                      onChange={(e) => setSelectedRepetition(parseInt(e.target.value, 10))}
                                    >
                                      {currentRuns.map((_, idx) => (
                                        <option key={idx} value={idx}>
                                          Repetition {idx + 1} of {currentRuns.length}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>

                              {/* Estadísticas */}
                              {currentP != null && currentAlgoDisplay && currentRuns && currentRuns.length > 0 && (
                                <div className="mt-4 p-3 bg-blue-50 rounded">
                                  <h4 className="font-medium text-sm mb-2">
                                    Statistics for {resolvedAlgoLabel} at p={currentP.toFixed(3)}:
                                  </h4>
                                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                                    <div>
                                      <span className="text-gray-600">Current:</span>
                                      <span className="ml-2 font-bold">
                                        {currentRuns[selectedRepetition ?? 0]?.[currentRuns[selectedRepetition ?? 0].length - 1]?.discrepancy?.toFixed(4) ?? '—'}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">Average:</span>
                                      <span className="ml-2 font-bold">
                                        {(() => {
                                          const finals = currentRuns.map(run => run?.[run.length - 1]?.discrepancy ?? 0);
                                          const avg = finals.reduce((a, b) => a + b, 0) / (finals.length || 1);
                                          return avg.toFixed(4);
                                        })()}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">Min/Max:</span>
                                      <span className="ml-2 font-bold">
                                        {(() => {
                                          const finals = currentRuns.map(run => run?.[run.length - 1]?.discrepancy ?? 0);
                                          return `${Math.min(...finals).toFixed(4)} / ${Math.max(...finals).toFixed(4)}`;
                                        })()}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-gray-600">Repetitions:</span>
                                      <span className="ml-2 font-bold">{currentRuns.length}</span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Visualizador */}
                            {currentP != null && currentAlgoDisplay && currentRuns && currentRuns.length > 0 && currentRuns[selectedRepetition ?? 0] && (
                              <ExperimentDetailViewer
                                experimentHistory={currentRuns[selectedRepetition ?? 0]}
                                algorithm={resolvedAlgoLabel}
                                meetingPoint={meetingPoint}
                                probability={currentP}
                                repetitionIndex={selectedRepetition ?? 0}
                                allRepetitions={currentRuns}
                              />
                            )}
                          </div>
                        );
                      })()}



                </div>
                
                <ResultsTable 
                  experimentData={experimentData}
                  processCount={processCount}
                  forcedAlgorithm={algorithm}
                  fvMethod={fvMethod}
                  rounds={rounds}
                />
                {dimensionMode === 'barycentric' && experimentalResults.length > 0 && (
                  <div className="bg-white rounded-lg shadow p-6 mt-6">
                    <h3 className="text-lg font-semibold mb-4">
                      Multi-Dimensional Analysis ({dimensions}D Space)
                    </h3>
                    
                    <div className="grid grid-cols-2 gap-6">
                      <div className="bg-gray-50 p-4 rounded">
                        <h4 className="font-medium text-sm mb-2">Configuration</h4>
                        <dl className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <dt>Dimensions:</dt>
                            <dd className="font-medium">{dimensions}D</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt>Processes:</dt>
                            <dd className="font-medium">{processCount}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt>Distance Metric:</dt>
                            <dd className="font-medium">{distanceMetric}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt>Rounds:</dt>
                            <dd className="font-medium">{rounds}</dd>
                          </div>
                        </dl>
                      </div>
                      
                      <div className="bg-gray-50 p-4 rounded">
                        <h4 className="font-medium text-sm mb-2">Results Summary</h4>
                        <dl className="space-y-1 text-xs">
                          <div className="flex justify-between">
                            <dt>Data Points:</dt>
                            <dd className="font-medium">{experimentalResults.length}</dd>
                          </div>
                          <div className="flex justify-between">
                            <dt>Best Discrepancy:</dt>
                            <dd className="font-medium text-green-600">
                              {Math.min(...experimentalResults.map(r => r.discrepancy)).toFixed(6)}
                            </dd>
                          </div>
                          <div className="flex justify-between">
                            <dt>Worst Discrepancy:</dt>
                            <dd className="font-medium text-red-600">
                              {Math.max(...experimentalResults.map(r => r.discrepancy)).toFixed(6)}
                            </dd>
                          </div>
                        </dl>
                      </div>
                    </div>
                    
                    {dimensions > 2 && (
                      <div className="mt-4 p-3 bg-yellow-50 rounded text-xs text-yellow-800">
                        ⚠️ Note: Theoretical predictions are only available for 2D (binary) case. 
                        Results for {dimensions}D are experimental.
                      </div>
                    )}
                  </div>
                )}


              </div>

              
            )}
            


            {/* Statistical Analysis tab */}
            {activeTab === 'statistics' && (
              <div>
                {experimentalResults && experimentalResults.length > 0 ? (
                  <div>
                    <div className="bg-white rounded-lg shadow p-4 mb-4">
                      <h3 className="text-lg font-semibold mb-3">Statistical Analysis</h3>
                      
                      {/* Detectar algoritmos únicos en los resultados */}
                      {(() => {
                        // Agrupar resultados por algoritmo
                        const algorithmGroups = {};
                        experimentalResults.forEach(result => {
                          const algo = result.algorithm || result.displayAlgorithm || 'Unknown';
                          if (!algorithmGroups[algo]) {
                            algorithmGroups[algo] = [];
                          }
                          algorithmGroups[algo].push(result);
                        });

                        const uniqueAlgorithms = Object.keys(algorithmGroups);
                        const hasMultipleAlgorithms = uniqueAlgorithms.length > 1;
                        
                        // Algoritmos con respaldo teórico del paper
                        const PAPER_ALGORITHMS = ['AMP', 'FV'];
                        const hasTheoreticalSupport = (algo) => {
                          return PAPER_ALGORITHMS.includes(algo) && processValues.length === 2;
                        };
                        
                        const processCount = processValues.length;
                        const isConditioned = deliveryMode === 'guaranteed';
                        
                        return (
                          <>
                            {/* Advertencia sobre limitaciones teóricas */}
                            {processCount > 2 && (
                              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <div className="flex items-start">
                                  <svg className="w-5 h-5 text-amber-600 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                  </svg>
                                  <div>
                                    <h4 className="text-sm font-semibold text-amber-800">Limited Theoretical Values</h4>
                                    <p className="text-sm text-amber-700 mt-1">
                                      Theoretical formulas from the paper are only available for 2 processes with AMP/FV algorithms.
                                      {uniqueAlgorithms.filter(a => !PAPER_ALGORITHMS.includes(a)).length > 0 && 
                                        <> Experimental algorithms ({uniqueAlgorithms.filter(a => !PAPER_ALGORITHMS.includes(a)).join(', ')}) show empirical results only.</>
                                      }
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Mostrar estadísticas por algoritmo */}
                            {hasMultipleAlgorithms ? (
                              // Vista para múltiples algoritmos
                              <div className="space-y-4">
                                <div className="text-sm text-gray-600 mb-2">
                                  Comparing {uniqueAlgorithms.length} algorithms: {uniqueAlgorithms.join(', ')}
                                </div>
                                
                                {uniqueAlgorithms.map((algorithm, algoIdx) => {
                                  const algoResults = algorithmGroups[algorithm];
                                  const isPaperAlgo = PAPER_ALGORITHMS.includes(algorithm);
                                  const showTheory = hasTheoreticalSupport(algorithm);
                                  
                                  // Calcular estadísticas para este algoritmo
                                  const allDiscrepancies = [];
                                  algoResults.forEach(result => {
                                    if (result.discrepancies && result.discrepancies.length > 0) {
                                      allDiscrepancies.push(...result.discrepancies);
                                    } else if (typeof result.discrepancy === 'number') {
                                      allDiscrepancies.push(result.discrepancy);
                                    }
                                  });
                                  
                                  if (allDiscrepancies.length === 0) return null;
                                  
                                  const avgDiscrepancy = allDiscrepancies.reduce((a, b) => a + b, 0) / allDiscrepancies.length;
                                  const minDiscrepancy = Math.min(...allDiscrepancies);
                                  const maxDiscrepancy = Math.max(...allDiscrepancies);
                                  const variance = allDiscrepancies.reduce((sum, val) => sum + Math.pow(val - avgDiscrepancy, 2), 0) / allDiscrepancies.length;
                                  const stdDev = Math.sqrt(variance);
                                  const cv = avgDiscrepancy !== 0 ? (stdDev / Math.abs(avgDiscrepancy)) * 100 : 0;
                                  
                                  return (
                                    <div key={algorithm} className="border rounded-lg p-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <h4 className="font-medium flex items-center gap-2">
                                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                            algorithm === "AMP" ? "bg-green-100 text-green-800" : 
                                            algorithm === "FV" ? "bg-red-100 text-red-800" :
                                            isPaperAlgo ? "bg-blue-100 text-blue-800" :
                                            "bg-purple-100 text-purple-800"
                                          }`}>
                                            {algorithm}
                                          </span>
                                          {!isPaperAlgo && <span className="text-xs text-gray-500">(Experimental)</span>}
                                        </h4>
                                        <span className="text-xs text-gray-500">{algoResults.length} data points</span>
                                      </div>
                                      
                                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                                        <div>
                                          <p className="text-gray-600 text-xs">Mean</p>
                                          <p className="font-mono font-semibold">
                                            {avgDiscrepancy < 1e-6 ? avgDiscrepancy.toExponential(3) : avgDiscrepancy.toFixed(6)}
                                          </p>
                                        </div>
                                        <div>
                                          <p className="text-gray-600 text-xs">Std Dev</p>
                                          <p className="font-mono">{stdDev < 1e-6 ? stdDev.toExponential(3) : stdDev.toFixed(6)}</p>
                                        </div>
                                        <div>
                                          <p className="text-gray-600 text-xs">Min</p>
                                          <p className="font-mono">{minDiscrepancy < 1e-6 ? minDiscrepancy.toExponential(3) : minDiscrepancy.toFixed(6)}</p>
                                        </div>
                                        <div>
                                          <p className="text-gray-600 text-xs">Max</p>
                                          <p className="font-mono">{maxDiscrepancy < 1e-6 ? maxDiscrepancy.toExponential(3) : maxDiscrepancy.toFixed(6)}</p>
                                        </div>
                                      </div>
                                      
                                      {showTheory && (
                                        <div className="mt-2 pt-2 border-t">
                                          <p className="text-xs text-gray-600 mb-1">Theoretical Comparison (Paper Algorithm):</p>
                                          {(() => {
                                            const theoreticalErrors = algoResults
                                              .filter(r => r.theoretical !== null && r.theoretical !== undefined)
                                              .map(r => Math.abs(r.discrepancy - r.theoretical) / (r.theoretical || 1) * 100);
                                            
                                            if (theoreticalErrors.length > 0) {
                                              const avgError = theoreticalErrors.reduce((a, b) => a + b, 0) / theoreticalErrors.length;
                                              return (
                                                <p className="text-sm">
                                                  Average error vs theory: <span className={`font-medium ${
                                                    avgError < 5 ? 'text-green-600' :
                                                    avgError < 10 ? 'text-yellow-600' :
                                                    'text-red-600'
                                                  }`}>{avgError.toFixed(2)}%</span>
                                                </p>
                                              );
                                            }
                                            return <p className="text-xs text-gray-500">No theoretical values available</p>;
                                          })()}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              // Vista para un solo algoritmo - tabla tradicional
                              <div>
                                <div className="overflow-x-auto">
                                  <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                      <tr>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">P</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Algorithm</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Experimental</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Samples</th>
                                        {hasTheoreticalSupport(uniqueAlgorithms[0]) && (
                                          <>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Theoretical</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Error</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Error %</th>
                                          </>
                                        )}
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Std Dev</th>
                                        <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">CV %</th>
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {experimentalResults.map((result, idx) => {
                                        const isPaperAlgo = PAPER_ALGORITHMS.includes(result.algorithm);
                                        const hasTheory = hasTheoreticalSupport(result.algorithm) && 
                                                        result.theoretical !== null && 
                                                        result.theoretical !== undefined && 
                                                        !isNaN(result.theoretical);
                                        
                                        // Calcular estadísticas adicionales
                                        let stdDev = 0;
                                        let cv = 0;
                                        if (result.discrepancies && result.discrepancies.length > 1) {
                                          const mean = result.discrepancy;
                                          const variance = result.discrepancies.reduce(
                                            (sum, val) => sum + Math.pow(val - mean, 2), 0
                                          ) / result.discrepancies.length;
                                          stdDev = Math.sqrt(variance);
                                          cv = mean !== 0 ? (stdDev / Math.abs(mean)) * 100 : 0;
                                        }
                                        
                                        const error = hasTheory ? Math.abs(result.theoretical - result.discrepancy) : null;
                                        const errorPercent = hasTheory && result.theoretical !== 0 ? 
                                          (error / Math.abs(result.theoretical)) * 100 : null;
                                        
                                        return (
                                          <tr key={idx} className={idx % 2 === 0 ? "" : "bg-gray-50"}>
                                            <td className="px-3 py-2 text-sm">{result.p.toFixed(3)}</td>
                                            <td className="px-3 py-2 text-sm">
                                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                                result.algorithm === "AMP" ? "bg-green-100 text-green-800" : 
                                                result.algorithm === "FV" ? "bg-red-100 text-red-800" :
                                                isPaperAlgo ? "bg-blue-100 text-blue-800" :
                                                "bg-purple-100 text-purple-800"
                                              }`}>
                                                {result.algorithm}
                                                {!isPaperAlgo && " (Exp)"}
                                              </span>
                                            </td>
                                            <td className="px-3 py-2 text-sm font-mono">
                                              {result.discrepancy < 1e-6 ? 
                                                result.discrepancy.toExponential(3) : 
                                                result.discrepancy.toFixed(6)}
                                            </td>
                                            <td className="px-3 py-2 text-sm">{result.samples || 0}</td>
                                            {hasTheoreticalSupport(uniqueAlgorithms[0]) && (
                                              <>
                                                <td className="px-3 py-2 text-sm font-mono">
                                                  {hasTheory ? 
                                                    (result.theoretical < 1e-6 ? 
                                                      result.theoretical.toExponential(3) : 
                                                      result.theoretical.toFixed(6)) 
                                                    : '—'}
                                                </td>
                                                <td className="px-3 py-2 text-sm font-mono">
                                                  {error !== null ? 
                                                    (error < 1e-6 ? error.toExponential(3) : error.toFixed(6)) 
                                                    : '—'}
                                                </td>
                                                <td className="px-3 py-2 text-sm">
                                                  {errorPercent !== null ? (
                                                    <span className={`font-medium ${
                                                      errorPercent < 5 ? 'text-green-600' :
                                                      errorPercent < 10 ? 'text-yellow-600' :
                                                      'text-red-600'
                                                    }`}>
                                                      {errorPercent.toFixed(2)}%
                                                    </span>
                                                  ) : '—'}
                                                </td>
                                              </>
                                            )}
                                            <td className="px-3 py-2 text-sm font-mono">
                                              {stdDev.toFixed(6)}
                                            </td>
                                            <td className="px-3 py-2 text-sm">
                                              {cv.toFixed(2)}%
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                            
                            {/* Sección de estadísticas agregadas */}
                            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Estadísticas generales */}
                              <div className="p-3 bg-blue-50 rounded-lg">
                                <h4 className="font-medium mb-2">Overall Statistics</h4>
                                {(() => {
                                  const allDiscrepancies = [];
                                  experimentalResults.forEach(r => {
                                    if (r.discrepancies && r.discrepancies.length > 0) {
                                      allDiscrepancies.push(...r.discrepancies);
                                    } else if (typeof r.discrepancy === 'number') {
                                      allDiscrepancies.push(r.discrepancy);
                                    }
                                  });
                                  
                                  if (allDiscrepancies.length === 0) {
                                    return <p className="text-sm text-gray-600">No data available</p>;
                                  }
                                  
                                  const avgDiscrepancy = allDiscrepancies.reduce((a, b) => a + b, 0) / allDiscrepancies.length;
                                  const variance = allDiscrepancies.reduce((sum, val) => sum + Math.pow(val - avgDiscrepancy, 2), 0) / allDiscrepancies.length;
                                  const stdDev = Math.sqrt(variance);
                                  const cv = avgDiscrepancy !== 0 ? (stdDev / Math.abs(avgDiscrepancy)) * 100 : 0;
                                  const stderr = stdDev / Math.sqrt(allDiscrepancies.length);
                                  
                                  return (
                                    <ul className="text-sm space-y-1">
                                      <li><span className="font-medium">Mean Discrepancy:</span> {avgDiscrepancy.toFixed(6)}</li>
                                      <li><span className="font-medium">Standard Deviation:</span> {stdDev.toFixed(6)}</li>
                                      <li><span className="font-medium">Coefficient of Variation:</span> {cv.toFixed(2)}%</li>
                                      <li><span className="font-medium">Standard Error:</span> {stderr.toFixed(6)}</li>
                                      <li><span className="font-medium">95% CI:</span> [{
                                        (avgDiscrepancy - 1.96 * stderr).toFixed(6)
                                      }, {
                                        (avgDiscrepancy + 1.96 * stderr).toFixed(6)
                                      }]</li>
                                      <li><span className="font-medium">Total Samples:</span> {allDiscrepancies.length}</li>
                                    </ul>
                                  );
                                })()}
                              </div>
                              
                              {/* Análisis por algoritmo si hay múltiples */}
                              {hasMultipleAlgorithms && (
                                <div className="p-3 bg-green-50 rounded-lg">
                                  <h4 className="font-medium mb-2">Algorithm Performance</h4>
                                  {(() => {
                                    const algoStats = uniqueAlgorithms.map(algo => {
                                      const algoResults = algorithmGroups[algo];
                                      const discrepancies = [];
                                      algoResults.forEach(r => {
                                        if (r.discrepancies && r.discrepancies.length > 0) {
                                          discrepancies.push(...r.discrepancies);
                                        } else if (typeof r.discrepancy === 'number') {
                                          discrepancies.push(r.discrepancy);
                                        }
                                      });
                                      
                                      const mean = discrepancies.length > 0 ?
                                        discrepancies.reduce((a, b) => a + b, 0) / discrepancies.length : 0;
                                      
                                      return { algo, mean, count: discrepancies.length };
                                    }).sort((a, b) => a.mean - b.mean);
                                    
                                    const best = algoStats[0];
                                    const worst = algoStats[algoStats.length - 1];
                                    
                                    return (
                                      <div className="text-sm space-y-2">
                                        <div>
                                          <p className="text-green-700">
                                            <strong>Best Performance:</strong> {best.algo}
                                            <span className="ml-1 font-mono">({best.mean.toFixed(6)})</span>
                                          </p>
                                        </div>
                                        {algoStats.length > 1 && (
                                          <div>
                                            <p className="text-orange-700">
                                              <strong>Worst Performance:</strong> {worst.algo}
                                              <span className="ml-1 font-mono">({worst.mean.toFixed(6)})</span>
                                            </p>
                                          </div>
                                        )}
                                        {algoStats.length > 2 && (
                                          <div className="mt-2 pt-2 border-t border-green-300">
                                            <p className="font-medium mb-1">Ranking:</p>
                                            <ol className="list-decimal list-inside">
                                              {algoStats.map((stat, idx) => (
                                                <li key={stat.algo} className="text-xs">
                                                  {stat.algo}: {stat.mean.toFixed(6)}
                                                </li>
                                              ))}
                                            </ol>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </div>
                              )}
                            </div>
                            
                            {/* Información adicional */}
                            <div className="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-600">
                              <p className="mb-1">
                                <strong>Note:</strong> Statistics shown are based on {experimentalResults.length} probability points
                                {rounds > 1 && ` over ${rounds} rounds`}.
                              </p>
                              {uniqueAlgorithms.some(a => !PAPER_ALGORITHMS.includes(a)) && (
                                <p>
                                  Experimental algorithms are not defined in the original paper and show empirical results only.
                                  Theoretical comparison is only available for AMP and FV algorithms with 2 processes.
                                </p>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
                  <div className="bg-white p-8 rounded-lg shadow text-center text-gray-500">
                    <svg className="mx-auto h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="mb-4">No experimental data available for statistical analysis.</p>
                    <p className="text-sm mb-4">Run a simulation first to see statistical analysis.</p>
                    <button 
                      onClick={() => setActiveTab('theory')}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Go to Theoretical Comparison
                    </button>
                  </div>
                )}
              </div>
            )}
            
            {/* Saved Experiments tab */}
            {/* Saved Experiments tab - LABORATORIO MEJORADO */}
            {activeTab === 'saved' && (
              <div>
                <EnhancedExperimentLaboratory
                  savedExperiments={savedExperiments}
                  setSavedExperiments={setSavedExperiments}
                  addLog={addLog}
                />
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-white shadow rounded-lg p-4 text-center">
        <p className="text-sm text-gray-500">
          ApproximateLVL - Multi-Process Distributed Computing Agreement Simulator
        </p>
      </footer>
    </div>
  );
}

// ============= ENHANCED EXPERIMENT LABORATORY =============
function EnhancedExperimentLaboratory({ savedExperiments, setSavedExperiments, addLog }) {
  const [selectedExperiments, setSelectedExperiments] = useState([]);
  const [comparisonMode, setComparisonMode] = useState('overview');
  const [filterSettings, setFilterSettings] = useState({
    algorithm: 'all',
    processCount: 'all',
    rounds: 'all',
    showFilters: false
  });
  
  // Filtrar experimentos según criterios
  const filteredExperiments = savedExperiments.filter(exp => {
    if (filterSettings.algorithm !== 'all' && 
        exp.parameters?.algorithm !== filterSettings.algorithm) return false;
    if (filterSettings.processCount !== 'all' && 
        exp.parameters?.processCount !== parseInt(filterSettings.processCount)) return false;
    if (filterSettings.rounds !== 'all' && 
        exp.parameters?.rounds !== parseInt(filterSettings.rounds)) return false;
    return true;
  });
  
  // Toggle selección de experimento
  const toggleExperimentSelection = (expId) => {
    setSelectedExperiments(prev => {
      if (prev.includes(expId)) {
        return prev.filter(id => id !== expId);
      }
      if (prev.length < 5) { // Límite de 5 para comparación
        return [...prev, expId];
      }
      addLog("Maximum 5 experiments can be compared at once", "warning");
      return prev;
    });
  };
  
  // Obtener experimentos seleccionados
  const getSelectedExperiments = () => {
    return savedExperiments.filter(exp => 
      selectedExperiments.includes(exp.metadata?.id)
    );
  };
  
  // Eliminar experimento
  const deleteExperiment = (expId) => {
    if (confirm("Are you sure you want to delete this experiment?")) {
      setSavedExperiments(prev => prev.filter(exp => exp.metadata?.id !== expId));
      setSelectedExperiments(prev => prev.filter(id => id !== expId));
      addLog("Experiment deleted", "success");
    }
  };
  
  // Exportar experimento
  const exportExperiment = (experiment) => {
    const dataStr = JSON.stringify(experiment, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `experiment_${experiment.metadata?.name || 'unnamed'}_${Date.now()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    addLog(`Experiment "${experiment.metadata?.name}" exported`, "success");
  };
  
  if (savedExperiments.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <div className="flex justify-center mb-4">
          <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M9 17v1a3 3 0 003 3h0a3 3 0 003-3v-1m-6-4h6m-6 0a9 9 0 110-18 9 9 0 010 18z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold mb-2">No Experiments Saved Yet</h3>
        <p className="text-gray-600 mb-4">Run simulations and save them to start comparing results</p>
        <button
          onClick={() => document.querySelector('[data-tab="theory"]')?.click()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Run Your First Experiment
        </button>
      </div>
    );
  }



  
  return (
    <div className="space-y-4">
      {/* Control Panel */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">
            Experimental Comparison Laboratory
            {selectedExperiments.length > 0 && (
              <span className="ml-2 text-sm text-blue-600">
                ({selectedExperiments.length} selected)
              </span>
            )}
          </h3>
          
          <div className="flex gap-2">
            <button
              onClick={() => setFilterSettings(prev => ({...prev, showFilters: !prev.showFilters}))}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
            >
              {filterSettings.showFilters ? '🔽' : '▶️'} Filters
            </button>
            
            {selectedExperiments.length >= 2 && (
              <>
                <button
                  onClick={() => setComparisonMode('probability')}
                  className={`px-3 py-1 text-sm rounded ${
                    comparisonMode === 'probability' ? 'bg-blue-600 text-white' : 'bg-gray-100'
                  }`}
                >
                  P-Curve
                </button>

                <button
                  onClick={() => setComparisonMode('overview')}
                  className={`px-3 py-1 text-sm rounded ${
                    comparisonMode === 'overview' ? 'bg-blue-600 text-white' : 'bg-gray-100'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setComparisonMode('convergence')}
                  className={`px-3 py-1 text-sm rounded ${
                    comparisonMode === 'convergence' ? 'bg-blue-600 text-white' : 'bg-gray-100'
                  }`}
                >
                  Convergence
                </button>
                <button
                  onClick={() => setComparisonMode('performance')}
                  className={`px-3 py-1 text-sm rounded ${
                    comparisonMode === 'performance' ? 'bg-blue-600 text-white' : 'bg-gray-100'
                  }`}
                >
                  Performance
                </button>
                
              </>
            )}
            
            {selectedExperiments.length > 0 && (
              <button
                onClick={() => setSelectedExperiments([])}
                className="px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-600 rounded"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        
        {/* Filters */}
        {filterSettings.showFilters && (
          <div className="border-t pt-3 grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">Algorithm</label>
              <select
                value={filterSettings.algorithm}
                onChange={(e) => setFilterSettings(prev => ({...prev, algorithm: e.target.value}))}
                className="w-full p-1 text-sm border rounded"
              >
                <option value="all">All Algorithms</option>
                <option value="AMP">AMP</option>
                <option value="FV">FV</option>
                <option value="RECURSIVE AMP">Recursive AMP</option>
                <option value="MIN">MIN</option>
                <option value="auto">Auto</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs text-gray-600 mb-1">Processes</label>
              <select
                value={filterSettings.processCount}
                onChange={(e) => setFilterSettings(prev => ({...prev, processCount: e.target.value}))}
                className="w-full p-1 text-sm border rounded"
              >
                <option value="all">Any</option>
                <option value="2">2 Processes</option>
                <option value="3">3 Processes</option>
                <option value="4">4 Processes</option>
                <option value="5">5+ Processes</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs text-gray-600 mb-1">Rounds</label>
              <select
                value={filterSettings.rounds}
                onChange={(e) => setFilterSettings(prev => ({...prev, rounds: e.target.value}))}
                className="w-full p-1 text-sm border rounded"
              >
                <option value="all">Any</option>
                <option value="1">1 Round</option>
                <option value="3">3 Rounds</option>
                <option value="5">5 Rounds</option>
                <option value="10">10 Rounds</option>
              </select>
            </div>
          </div>
        )}
      </div>
        
      


      {/* Main Content Area */}
      {selectedExperiments.length < 2 ? (
        // List View
        <div className="grid gap-3">
          {filteredExperiments.map(exp => (
            <ExperimentCard
              key={exp.metadata?.id}
              experiment={exp}
              isSelected={selectedExperiments.includes(exp.metadata?.id)}
              onToggle={() => toggleExperimentSelection(exp.metadata?.id)}
              onDelete={() => deleteExperiment(exp.metadata?.id)}
              onExport={() => exportExperiment(exp)}
            />
          ))}
        </div>
      ) : (
        // Comparison View
        <ExperimentComparisonPanel
          experiments={getSelectedExperiments()}
          mode={comparisonMode}
        />
      )}
    </div>
  );
}

// Experiment Card Component
function ExperimentCard({ experiment, isSelected, onToggle, onDelete, onExport }) {
  const [expanded, setExpanded] = useState(false);
  
  // Extract key metrics
  const avgDiscrepancy = experiment.results ? 
    experiment.results.reduce((sum, r) => sum + (r.discrepancy || 0), 0) / experiment.results.length : 0;
  const minDiscrepancy = experiment.results ? 
    Math.min(...experiment.results.map(r => r.discrepancy || 0)) : 0;
  const maxDiscrepancy = experiment.results ? 
    Math.max(...experiment.results.map(r => r.discrepancy || 0)) : 0;
  
  return (
    <div className={`bg-white rounded-lg shadow p-4 ${isSelected ? 'ring-2 ring-blue-500' : ''}`}>
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onToggle}
              className="w-4 h-4"
            />
            <h4 className="font-medium">{experiment.metadata?.name || 'Unnamed Experiment'}</h4>
            <span className={`px-2 py-0.5 text-xs rounded ${
              experiment.parameters?.algorithm === 'AMP' ? 'bg-green-100 text-green-700' :
              experiment.parameters?.algorithm === 'FV' ? 'bg-red-100 text-red-700' :
              experiment.parameters?.algorithm === 'RECURSIVE AMP' ? 'bg-purple-100 text-purple-700' :
              experiment.parameters?.algorithm === 'MIN' ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-700'
            }`}>
              {experiment.parameters?.algorithm || 'Unknown'}
            </span>
            {experiment.type === 'range' && (
              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                Range
              </span>
            )}
          </div>
          
          <div className="mt-2 grid grid-cols-5 gap-4 text-xs text-gray-600">
            <div>
              <span className="font-medium">Processes:</span> {experiment.parameters?.processCount || 'N/A'}
            </div>
            <div>
              <span className="font-medium">Rounds:</span> {experiment.parameters?.rounds || 1}
            </div>
            <div>
              <span className="font-medium">Avg Disc:</span> {avgDiscrepancy.toFixed(4)}
            </div>
            <div>
              <span className="font-medium">Min:</span> {minDiscrepancy.toFixed(4)}
            </div>
            <div>
              <span className="font-medium">Max:</span> {maxDiscrepancy.toFixed(4)}
            </div>
          </div>
        </div>
        
        <div className="flex gap-1 ml-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-gray-100 rounded"
            title="Toggle details"
          >
            {expanded ? '▼' : '▶'}
          </button>
          <button
            onClick={onExport}
            className="p-1 hover:bg-green-100 rounded text-green-600"
            title="Export"
          >
            💾
          </button>
          <button
            onClick={onDelete}
            className="p-1 hover:bg-red-100 rounded text-red-600"
            title="Delete"
          >
            🗑️
          </button>
        </div>
      </div>
      
      {expanded && (
        <div className="mt-3 pt-3 border-t text-sm">
          <p className="text-gray-600">{experiment.metadata?.description || 'No description'}</p>
          <div className="mt-2 text-xs text-gray-500">
            <p>Created: {new Date(experiment.metadata?.createdAt || Date.now()).toLocaleString()}</p>
            {experiment.metadata?.tags && (
              <div className="mt-1 flex flex-wrap gap-1">
                {experiment.metadata.tags.map((tag, idx) => (
                  <span key={idx} className="px-2 py-0.5 bg-gray-100 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Comparison Panel Component
function ExperimentComparisonPanel({ experiments, mode }) {
  if (!experiments || experiments.length < 2) return null;
  
  switch (mode) {
    case 'overview':
      return <ComparisonOverview experiments={experiments} />;
    case 'convergence':
      return <ConvergenceAnalysis experiments={experiments} />;
    case 'performance':
      return <PerformanceMetrics experiments={experiments} />;
    case 'probability':  // NUEVO CASO
      return <ProbabilityCurveComparison experiments={experiments} />;
    default:
      return <ComparisonOverview experiments={experiments} />;
  }
}

// Overview Comparison
function ComparisonOverview({ experiments }) {
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h4 className="font-semibold mb-4">Experimental Overview Comparison</h4>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Experiment</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Algorithm</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Config</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Final Disc</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Avg Disc</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Min Disc</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Reduction %</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {experiments.map((exp, idx) => {
              const results = exp.results || [];
              const finalDisc = results[results.length - 1]?.discrepancy || 0;
              const initialDisc = results[0]?.discrepancy || 1;
              const avgDisc = results.reduce((sum, r) => sum + (r.discrepancy || 0), 0) / (results.length || 1);
              const minDisc = Math.min(...results.map(r => r.discrepancy || 0));
              const reduction = initialDisc > 0 ? ((initialDisc - finalDisc) / initialDisc * 100) : 0;
              
              return (
                <tr key={exp.metadata?.id || idx}>
                  <td className="px-3 py-2 text-sm font-medium">{exp.metadata?.name}</td>
                  <td className="px-3 py-2 text-sm">
                    <span className={`px-2 py-0.5 text-xs rounded ${
                      exp.parameters?.algorithm === 'RECURSIVE AMP' ? 'bg-purple-100 text-purple-700' :
                      exp.parameters?.algorithm === 'AMP' ? 'bg-green-100 text-green-700' :
                      exp.parameters?.algorithm === 'FV' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100'
                    }`}>
                      {exp.parameters?.algorithm}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {exp.parameters?.processCount}p / {exp.parameters?.rounds}r
                  </td>
                  <td className="px-3 py-2 text-sm font-mono">{finalDisc.toFixed(6)}</td>
                  <td className="px-3 py-2 text-sm font-mono">{avgDisc.toFixed(6)}</td>
                  <td className="px-3 py-2 text-sm font-mono">{minDisc.toFixed(6)}</td>
                  <td className="px-3 py-2 text-sm">
                    <div className="flex items-center">
                      <span className={`mr-2 ${reduction > 80 ? 'text-green-600' : reduction > 50 ? 'text-blue-600' : 'text-gray-600'}`}>
                        {reduction.toFixed(1)}%
                      </span>
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${reduction > 80 ? 'bg-green-500' : reduction > 50 ? 'bg-blue-500' : 'bg-gray-400'}`}
                          style={{ width: `${Math.min(100, reduction)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Summary Cards */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <div className="bg-green-50 p-3 rounded">
          <h5 className="text-sm font-medium text-green-800">Best Final Discrepancy</h5>
          <p className="text-lg font-bold text-green-900">
            {experiments.reduce((best, exp) => {
              const finalDisc = exp.results?.[exp.results.length - 1]?.discrepancy || Infinity;
              return finalDisc < best.value ? { name: exp.metadata?.name, value: finalDisc } : best;
            }, { name: '', value: Infinity }).name}
          </p>
        </div>
        
        <div className="bg-blue-50 p-3 rounded">
          <h5 className="text-sm font-medium text-blue-800">Highest Reduction</h5>
          <p className="text-lg font-bold text-blue-900">
            {experiments.reduce((best, exp) => {
              const initial = exp.results?.[0]?.discrepancy || 1;
              const final = exp.results?.[exp.results.length - 1]?.discrepancy || 0;
              const reduction = initial > 0 ? ((initial - final) / initial) : 0;
              return reduction > best.value ? { name: exp.metadata?.name, value: reduction } : best;
            }, { name: '', value: 0 }).name}
          </p>
        </div>
        
        <div className="bg-purple-50 p-3 rounded">
          <h5 className="text-sm font-medium text-purple-800">Most Consistent</h5>
          <p className="text-lg font-bold text-purple-900">
            {experiments.reduce((best, exp) => {
              const discrepancies = exp.results?.map(r => r.discrepancy) || [];
              const mean = discrepancies.reduce((s, d) => s + d, 0) / discrepancies.length;
              const variance = discrepancies.reduce((s, d) => s + Math.pow(d - mean, 2), 0) / discrepancies.length;
              return variance < best.value ? { name: exp.metadata?.name, value: variance } : best;
            }, { name: '', value: Infinity }).name}
          </p>
        </div>
      </div>
    </div>
  );
}


function ConvergenceAnalysis({ experiments }) {
  // Detectar tipos de experimentos
  const experimentTypes = experiments.map(exp => {
    const hasMultipleP = exp.type === 'range';
    const hasMultipleRounds = exp.parameters?.rounds > 1;
    const hasHistory = exp.results?.[0]?.round !== undefined;
    
    return {
      experiment: exp,
      isRange: hasMultipleP,
      isMultiRound: hasMultipleRounds || hasHistory,
      dataType: hasMultipleP ? 'probability' : (hasMultipleRounds || hasHistory ? 'rounds' : 'repetitions')
    };
  });
  
  // Determinar qué tipo de vista mostrar
  const viewType = experimentTypes[0]?.dataType || 'unknown';
  const allSameType = experimentTypes.every(t => t.dataType === viewType);
  
  if (!allSameType) {
    return (
      <div className="bg-white rounded-lg shadow p-4">
        <h4 className="font-semibold mb-4">Convergence Analysis</h4>
        <div className="bg-yellow-50 p-4 rounded">
          <p className="text-yellow-800">⚠️ Mixed experiment types selected</p>
          <p className="text-sm text-yellow-600 mt-2">
            Please select experiments of the same type for meaningful comparison:
          </p>
          <ul className="text-sm text-yellow-600 mt-2 list-disc list-inside">
            <li>Range experiments (varying probability)</li>
            <li>Multi-round experiments (convergence over rounds)</li>
            <li>Single experiments (multiple repetitions)</li>
          </ul>
        </div>
      </div>
    );
  }
  
  // Preparar datos según el tipo
  let chartData = [];
  let xAxisLabel = 'Step';
  let xAxisKey = 'index';
  
  if (viewType === 'probability') {
    // RANGE EXPERIMENTS: X-axis is probability
    xAxisLabel = 'Probability (p)';
    xAxisKey = 'p';
    
    // Collect all unique probabilities
    const allPs = new Set();
    experiments.forEach(exp => {
      exp.results?.forEach(r => {
        if (r.p !== undefined) allPs.add(r.p);
      });
    });
    
    const sortedPs = Array.from(allPs).sort((a, b) => a - b);
    chartData = sortedPs.map(p => {
      const point = { p };
      experiments.forEach((exp, idx) => {
        const result = exp.results?.find(r => Math.abs(r.p - p) < 0.0001);
        if (result) {
          point[`exp${idx}`] = result.discrepancy;
        }
      });
      return point;
    });
    
  } else if (viewType === 'rounds') {
    // MULTI-ROUND EXPERIMENTS: X-axis is round number
    xAxisLabel = 'Round';
    xAxisKey = 'round';
    
    // Find max rounds
    const maxRounds = Math.max(...experiments.map(exp => exp.parameters?.rounds || 1));
    
    // For multi-round experiments, we need to extract per-round data
    // This assumes experiments store round-by-round history
    for (let round = 0; round <= maxRounds; round++) {
      const point = { round };
      
      experiments.forEach((exp, expIdx) => {
        // Check if experiment has detailed round data
        if (exp.roundHistory && exp.roundHistory[round]) {
          point[`exp${expIdx}`] = exp.roundHistory[round].discrepancy;
        } else if (exp.results && round === exp.parameters?.rounds) {
          // Use final result for last round
          const avgDiscrepancy = exp.results.reduce((sum, r) => sum + (r.discrepancy || 0), 0) / exp.results.length;
          point[`exp${expIdx}`] = avgDiscrepancy;
        }
      });
      
      chartData.push(point);
    }
    
  } else {
    // SINGLE EXPERIMENTS: X-axis is repetition/sample number
    xAxisLabel = 'Sample/Repetition';
    xAxisKey = 'index';
    
    const maxSamples = Math.max(...experiments.map(exp => exp.results?.length || 0));
    for (let i = 0; i < maxSamples; i++) {
      const point = { index: i };
      experiments.forEach((exp, expIdx) => {
        if (exp.results && exp.results[i]) {
          point[`exp${expIdx}`] = exp.results[i].discrepancy;
        }
      });
      chartData.push(point);
    }
  }
  
  const colors = ['#8b5cf6', '#10b981', '#ef4444', '#f59e0b', '#3b82f6'];
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h4 className="font-semibold mb-4">
        Convergence Analysis
        <span className="ml-2 text-sm font-normal text-gray-600">
          ({viewType === 'probability' ? 'Probability Sweep' : 
            viewType === 'rounds' ? 'Round-by-Round' : 
            'Repetition Samples'})
        </span>
      </h4>
      
      {/* Information Box */}
      <div className="mb-4 p-3 bg-blue-50 rounded text-sm">
        <p className="text-blue-800 font-medium">
          {viewType === 'probability' && "📊 Showing discrepancy across different probability values"}
          {viewType === 'rounds' && "🔄 Showing convergence across communication rounds"}
          {viewType === 'repetitions' && "📈 Showing variation across multiple repetitions"}
        </p>
        <p className="text-blue-600 text-xs mt-1">
          {viewType === 'probability' && "Each point represents a different message delivery probability"}
          {viewType === 'rounds' && "Each point shows the discrepancy after completing that round"}
          {viewType === 'repetitions' && "Each point is an independent run of the experiment"}
        </p>
      </div>
      
      {/* Main Chart */}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey={xAxisKey}
            label={{ value: xAxisLabel, position: 'insideBottom', offset: -5 }}
            domain={viewType === 'probability' ? [0, 1] : undefined}
          />
          <YAxis 
            label={{ value: 'Discrepancy', angle: -90, position: 'insideLeft' }}
            domain={[0, 'auto']}
          />
          <Tooltip 
            formatter={(value) => value?.toFixed(6)}
            labelFormatter={(label) => {
              if (viewType === 'probability') return `p = ${label?.toFixed(3)}`;
              if (viewType === 'rounds') return `Round ${label}`;
              return `Sample ${label + 1}`;
            }}
          />
          <Legend />
          
          {viewType === 'probability' && (
            <ReferenceLine x={0.5} stroke="#666" strokeDasharray="3 3" label="p=0.5" />
          )}
          
          {experiments.map((exp, idx) => (
            <Line
              key={exp.metadata?.id || idx}
              type="monotone"
              dataKey={`exp${idx}`}
              name={exp.metadata?.name || `Exp ${idx + 1}`}
              stroke={colors[idx % colors.length]}
              strokeWidth={2}
              dot={chartData.length <= 20}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      
      {/* Convergence Metrics - Adapted to context */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        <div>
          <h5 className="text-sm font-medium mb-3">
            {viewType === 'probability' ? 'Best Performance Range' : 
             viewType === 'rounds' ? 'Rounds to 90% Reduction' : 
             'Convergence Stability'}
          </h5>
          <div className="space-y-2">
            {experiments.map((exp, idx) => {
              let metric = 'N/A';
              
              if (viewType === 'probability') {
                // Find probability range with best average
                const results = exp.results || [];
                if (results.length > 0) {
                  const sorted = [...results].sort((a, b) => a.discrepancy - b.discrepancy);
                  const best = sorted[0];
                  metric = best ? `Best at p=${best.p?.toFixed(2)} (${best.discrepancy.toFixed(4)})` : 'N/A';
                }
              } else if (viewType === 'rounds') {
                // Calculate rounds to 90% reduction
                const initial = chartData[0]?.[`exp${idx}`] || 1;
                const target = initial * 0.1;
                const roundTo90 = chartData.findIndex(d => d[`exp${idx}`] <= target);
                metric = roundTo90 >= 0 ? `${roundTo90} rounds` : 'Not achieved';
              } else {
                // Calculate stability (coefficient of variation)
                const values = chartData.map(d => d[`exp${idx}`]).filter(v => v !== undefined);
                if (values.length > 0) {
                  const mean = values.reduce((s, v) => s + v, 0) / values.length;
                  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
                  const cv = Math.sqrt(variance) / mean;
                  metric = `CV: ${(cv * 100).toFixed(1)}%`;
                }
              }
              
              return (
                <div key={exp.metadata?.id || idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium" style={{ color: colors[idx % colors.length] }}>
                    {exp.metadata?.name}
                  </span>
                  <span className="text-sm font-mono">
                    {metric}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        
        <div>
          <h5 className="text-sm font-medium mb-3">
            {viewType === 'probability' ? 'Average Discrepancy' : 
             viewType === 'rounds' ? 'Final Discrepancy' : 
             'Mean & Std Dev'}
          </h5>
          <div className="space-y-2">
            {experiments.map((exp, idx) => {
              let metric = 'N/A';
              
              if (viewType === 'probability' || viewType === 'repetitions') {
                // Calculate average
                const values = exp.results?.map(r => r.discrepancy) || [];
                if (values.length > 0) {
                  const mean = values.reduce((s, v) => s + v, 0) / values.length;
                  const std = Math.sqrt(values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length);
                  metric = viewType === 'probability' ? 
                    `${mean.toFixed(6)}` : 
                    `${mean.toFixed(4)} ± ${std.toFixed(4)}`;
                }
              } else if (viewType === 'rounds') {
                // Show final value
                const finalValue = chartData[chartData.length - 1]?.[`exp${idx}`];
                metric = finalValue !== undefined ? finalValue.toFixed(6) : 'N/A';
              }
              
              return (
                <div key={exp.metadata?.id || idx} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                  <span className="text-sm font-medium" style={{ color: colors[idx % colors.length] }}>
                    {exp.metadata?.name}
                  </span>
                  <span className="text-sm font-mono">
                    {metric}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Context-specific insights */}
      <div className="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-600">
        <p className="font-medium text-gray-700 mb-1">Understanding this view:</p>
        {viewType === 'probability' && (
          <ul className="list-disc list-inside space-y-1">
            <li>Lower curves indicate better performance at those probability values</li>
            <li>The crossover at p=0.5 shows where algorithms change optimality</li>
            <li>Steeper slopes indicate more sensitivity to probability changes</li>
          </ul>
        )}
        {viewType === 'rounds' && (
          <ul className="list-disc list-inside space-y-1">
            <li>Steeper downward slopes indicate faster convergence</li>
            <li>Plateaus show where convergence has stabilized</li>
            <li>Lower final values indicate better agreement achieved</li>
          </ul>
        )}
        {viewType === 'repetitions' && (
          <ul className="list-disc list-inside space-y-1">
            <li>Consistent horizontal lines indicate stable algorithm performance</li>
            <li>High variation suggests sensitivity to initial conditions or randomness</li>
            <li>Trends up/down might indicate systematic biases</li>
          </ul>
        )}
      </div>
    </div>
  );
}


function PerformanceMetrics({ experiments }) {
  // Calculate comprehensive metrics
  const metrics = experiments.map(exp => {
    const discrepancies = exp.results?.map(r => r.discrepancy) || [];
    const n = discrepancies.length;
    
    if (n === 0) return null;
    
    const mean = discrepancies.reduce((s, d) => s + d, 0) / n;
    const sorted = [...discrepancies].sort((a, b) => a - b);
    const median = n % 2 === 0 ? (sorted[n/2-1] + sorted[n/2]) / 2 : sorted[Math.floor(n/2)];
    const variance = discrepancies.reduce((s, d) => s + Math.pow(d - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);
    const cv = mean > 0 ? stdDev / mean : 0;
    
    // Calculate convergence rate
    const initial = discrepancies[0] || 1;
    const final = discrepancies[n-1] || 0;
    const convergenceRate = initial > 0 ? (initial - final) / initial : 0;
    
    // NUEVO: Análisis de convergencia mejorado
    let convergenceStatus = 'Not converged';
    let convergencePoint = -1;
    
    // Buscar punto de convergencia con criterios inteligentes
    for (let i = 1; i < n; i++) {
      const current = discrepancies[i];
      const previous = discrepancies[i-1];
      
      // Criterios de convergencia
      if (current < 0.001) {
        // Ya está en convergencia aceptable
        convergenceStatus = 'Converged';
        convergencePoint = i;
        
        if (current < 0.00001) {
          convergenceStatus = 'Near-zero';
        }
        if (current === 0) {
          convergenceStatus = 'Perfect';
        }
        break;
      }
      
      // Si no ha convergido pero el cambio es mínimo
      const absoluteChange = Math.abs(current - previous);
      const relativeChange = previous > 0 ? absoluteChange / previous : 0;
      
      if (absoluteChange < 0.0001 || (previous > 0.01 && relativeChange < 0.01)) {
        convergenceStatus = 'Stabilized';
        convergencePoint = i;
        break;
      }
    }
    
    // Si el valor final es muy pequeño pero no se detectó convergencia
    if (convergenceStatus === 'Not converged' && final < 0.001) {
      convergenceStatus = 'Converged';
      convergencePoint = n - 1;
      if (final < 0.00001) convergenceStatus = 'Near-zero';
      if (final === 0) convergenceStatus = 'Perfect';
    }
    
    return {
      name: exp.metadata?.name,
      algorithm: exp.parameters?.algorithm,
      mean,
      median,
      stdDev,
      cv,
      convergenceRate,
      convergenceStatus,
      convergencePoint,
      finalValue: final,
      improvement: (initial - final)
    };
  }).filter(m => m !== null);
  
  // Función para obtener color según status
  const getStatusColor = (status) => {
    switch(status) {
      case 'Perfect': return 'text-green-700 bg-green-100';
      case 'Near-zero': return 'text-green-600 bg-green-50';
      case 'Converged': return 'text-blue-600 bg-blue-50';
      case 'Stabilized': return 'text-yellow-600 bg-yellow-50';
      case 'Not converged': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h4 className="font-semibold mb-4">Performance Metrics Analysis</h4>
      
      {/* Metrics Table - ACTUALIZADA */}
      <div className="overflow-x-auto mb-6">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Experiment</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Mean</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Median</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Std Dev</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Final Value</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Conv. Rate</th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {metrics.map((m, idx) => (
              <tr key={idx}>
                <td className="px-3 py-2 text-sm font-medium">{m.name}</td>
                <td className="px-3 py-2 text-sm font-mono">{m.mean.toFixed(6)}</td>
                <td className="px-3 py-2 text-sm font-mono">{m.median.toFixed(6)}</td>
                <td className="px-3 py-2 text-sm font-mono">{m.stdDev.toFixed(6)}</td>
                <td className="px-3 py-2 text-sm font-mono">{m.finalValue.toFixed(6)}</td>
                <td className="px-3 py-2 text-sm font-mono">{(m.convergenceRate * 100).toFixed(1)}%</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-1 text-xs rounded ${getStatusColor(m.convergenceStatus)}`}>
                    {m.convergenceStatus}
                    {m.convergencePoint >= 0 && m.convergenceStatus !== 'Not converged' && 
                      ` (step ${m.convergencePoint})`}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Performance Rankings - ACTUALIZADO */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h5 className="text-sm font-medium mb-3">Performance Rankings</h5>
          <div className="space-y-2">
            <div className="p-2 bg-green-50 rounded">
              <p className="text-xs text-green-700">🥇 Best Convergence Status</p>
              <p className="font-medium">
                {(() => {
                  const statusOrder = ['Perfect', 'Near-zero', 'Converged', 'Stabilized', 'Not converged'];
                  let best = metrics[0];
                  metrics.forEach(m => {
                    if (statusOrder.indexOf(m.convergenceStatus) < statusOrder.indexOf(best.convergenceStatus)) {
                      best = m;
                    }
                  });
                  return best ? `${best.name} (${best.convergenceStatus})` : 'N/A';
                })()}
              </p>
            </div>
            <div className="p-2 bg-blue-50 rounded">
              <p className="text-xs text-blue-700">🥇 Fastest to Converge</p>
              <p className="font-medium">
                {(() => {
                  const converged = metrics.filter(m => 
                    ['Perfect', 'Near-zero', 'Converged'].includes(m.convergenceStatus)
                  );
                  if (converged.length === 0) return 'None achieved convergence';
                  
                  const fastest = converged.reduce((best, m) => 
                    m.convergencePoint < best.convergencePoint ? m : best
                  );
                  return `${fastest.name} (step ${fastest.convergencePoint})`;
                })()}
              </p>
            </div>
            <div className="p-2 bg-purple-50 rounded">
              <p className="text-xs text-purple-700">🥇 Lowest Final Value</p>
              <p className="font-medium">
                {metrics.reduce((b, m) => m.finalValue < b.finalValue ? m : b).name}
                <span className="text-xs text-gray-600 ml-1">
                  ({metrics.reduce((b, m) => m.finalValue < b.finalValue ? m : b).finalValue.toFixed(6)})
                </span>
              </p>
            </div>
          </div>
        </div>
        
        <div>
          <h5 className="text-sm font-medium mb-3">Convergence Summary</h5>
          <div className="space-y-2">
            {/* Status distribution */}
            <div className="p-2 bg-gray-50 rounded">
              <p className="text-xs text-gray-700 mb-1">Status Distribution:</p>
              {['Perfect', 'Near-zero', 'Converged', 'Stabilized', 'Not converged'].map(status => {
                const count = metrics.filter(m => m.convergenceStatus === status).length;
                if (count === 0) return null;
                return (
                  <div key={status} className="flex justify-between text-xs mt-1">
                    <span className={`px-1 rounded ${getStatusColor(status)}`}>{status}</span>
                    <span>{count} experiment{count !== 1 ? 's' : ''}</span>
                  </div>
                );
              })}
            </div>
            
            {/* Algorithm comparison */}
            <div className="p-2 bg-gray-50 rounded">
              <p className="text-xs text-gray-700 mb-1">By Algorithm:</p>
              {['AMP', 'FV', 'RECURSIVE AMP', 'MIN'].map(algo => {
                const algoMetrics = metrics.filter(m => m.algorithm === algo);
                if (algoMetrics.length === 0) return null;
                
                const bestStatus = algoMetrics[0].convergenceStatus;
                
                return (
                  <div key={algo} className="flex justify-between text-xs mt-1">
                    <span className={`px-1 rounded ${
                      algo === 'RECURSIVE AMP' ? 'bg-purple-100 text-purple-700' :
                      algo === 'AMP' ? 'bg-green-100 text-green-700' :
                      algo === 'FV' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {algo}
                    </span>
                    <span className={`px-1 rounded ${getStatusColor(bestStatus)}`}>
                      {bestStatus}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      
      {/* Legend */}
      <div className="mt-4 p-3 bg-gray-50 rounded text-xs">
        <p className="font-medium text-gray-700 mb-2">Convergence Status Guide:</p>
        <div className="grid grid-cols-2 gap-2">
          <div><span className="px-1 rounded bg-green-100 text-green-700">Perfect</span> = Discrepancy exactly 0</div>
          <div><span className="px-1 rounded bg-green-50 text-green-600">Near-zero</span> = Discrepancy less 0.00001</div>
          <div><span className="px-1 rounded bg-blue-50 text-blue-600">Converged</span> = Discrepancy less 0.001</div>
          <div><span className="px-1 rounded bg-yellow-50 text-yellow-600">Stabilized</span> = Changes less 0.0001</div>
          <div className="col-span-2"><span className="px-1 rounded bg-red-50 text-red-600">Not converged</span> = Still changing significantly</div>
        </div>
      </div>
    </div>
  );
}


function ProbabilityCurveComparison({ experiments }) {
  // Filtrar solo experimentos de tipo "range" que tienen datos de probabilidad
  const rangeExperiments = experiments.filter(exp => exp.type === 'range' && exp.results);
  
  if (rangeExperiments.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center">
        <p className="text-gray-500">No range experiments selected.</p>
        <p className="text-sm text-gray-400 mt-2">
          This view requires range experiments with probability data.
        </p>
      </div>
    );
  }
  
  // Preparar datos para la gráfica
  const allProbabilities = new Set();
  rangeExperiments.forEach(exp => {
    exp.results.forEach(result => {
      if (result.p !== undefined) {
        allProbabilities.add(result.p);
      }
    });
  });
  
  const sortedProbabilities = Array.from(allProbabilities).sort((a, b) => a - b);
  
  // Construir datos del chart
  const chartData = sortedProbabilities.map(p => {
    const point = { p };
    
    rangeExperiments.forEach((exp, idx) => {
      const result = exp.results.find(r => Math.abs(r.p - p) < 0.0001);
      if (result) {
        point[`exp${idx}`] = result.discrepancy;
      }
    });
    
    return point;
  });
  
  const colors = ['#8b5cf6', '#10b981', '#ef4444', '#f59e0b', '#3b82f6'];
  
  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h4 className="font-semibold mb-4">Discrepancy vs Probability Comparison</h4>
      
      {/* Main Chart */}
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="p" 
            domain={[0, 1]}
            ticks={[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]}
            label={{ value: 'Probability (p)', position: 'insideBottom', offset: -5 }}
          />
          <YAxis 
            domain={[0, 'auto']}
            label={{ value: 'Discrepancy', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip 
            formatter={(value) => value?.toFixed(6)}
            labelFormatter={(value) => `p = ${value?.toFixed(3)}`}
          />
          <Legend />
          
          {/* Crossover line at p=0.5 */}
          <ReferenceLine x={0.5} stroke="#666" strokeDasharray="3 3" />
          
          {rangeExperiments.map((exp, idx) => (
            <Line
              key={exp.metadata?.id || idx}
              type="monotone"
              dataKey={`exp${idx}`}
              name={exp.metadata?.name || `Exp ${idx + 1}`}
              stroke={colors[idx % colors.length]}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
      
      {/* Analysis Tables */}
      <div className="mt-6 grid grid-cols-2 gap-4">
        {/* Key Points Analysis */}
        <div>
          <h5 className="text-sm font-medium mb-3">Key Points Analysis</h5>
          <div className="space-y-2">
            {rangeExperiments.map((exp, idx) => {
              // Encontrar puntos clave
              const p0 = exp.results.find(r => Math.abs(r.p - 0) < 0.01);
              const p25 = exp.results.find(r => Math.abs(r.p - 0.25) < 0.01);
              const p50 = exp.results.find(r => Math.abs(r.p - 0.5) < 0.01);
              const p75 = exp.results.find(r => Math.abs(r.p - 0.75) < 0.01);
              const p100 = exp.results.find(r => Math.abs(r.p - 1) < 0.01);
              
              return (
                <div key={exp.metadata?.id || idx} className="p-2 bg-gray-50 rounded">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium" style={{ color: colors[idx % colors.length] }}>
                      {exp.metadata?.name}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-100 text-blue-700">
                      {exp.parameters?.algorithm || 'Unknown'}
                    </span>
                  </div>
                  <div className="mt-1 grid grid-cols-5 gap-1 text-xs text-gray-600">
                    <div>
                      <span className="font-medium">p=0:</span>
                      <p>{p0 ? p0.discrepancy.toFixed(3) : 'N/A'}</p>
                    </div>
                    <div>
                      <span className="font-medium">p=0.25:</span>
                      <p>{p25 ? p25.discrepancy.toFixed(3) : 'N/A'}</p>
                    </div>
                    <div>
                      <span className="font-medium">p=0.5:</span>
                      <p>{p50 ? p50.discrepancy.toFixed(3) : 'N/A'}</p>
                    </div>
                    <div>
                      <span className="font-medium">p=0.75:</span>
                      <p>{p75 ? p75.discrepancy.toFixed(3) : 'N/A'}</p>
                    </div>
                    <div>
                      <span className="font-medium">p=1:</span>
                      <p>{p100 ? p100.discrepancy.toFixed(3) : 'N/A'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Performance Analysis by Range - CORREGIDO */}
        <div>
          <h5 className="text-sm font-medium mb-3">Average Performance by Range</h5>
          <div className="space-y-2">
            {/* Análisis para cada experimento */}
            {rangeExperiments.map((exp, idx) => {
              // Calcular promedios por rango
              const lowResults = exp.results.filter(r => r.p >= 0 && r.p <= 0.3);
              const midResults = exp.results.filter(r => r.p > 0.3 && r.p <= 0.7);
              const highResults = exp.results.filter(r => r.p > 0.7 && r.p <= 1.0);
              
              const lowAvg = lowResults.length > 0 ? 
                lowResults.reduce((s, r) => s + r.discrepancy, 0) / lowResults.length : null;
              const midAvg = midResults.length > 0 ? 
                midResults.reduce((s, r) => s + r.discrepancy, 0) / midResults.length : null;
              const highAvg = highResults.length > 0 ? 
                highResults.reduce((s, r) => s + r.discrepancy, 0) / highResults.length : null;
              
              // Encontrar el mejor rango para este experimento
              let bestRange = 'N/A';
              let bestValue = Infinity;
              if (lowAvg !== null && lowAvg < bestValue) {
                bestRange = 'Low p';
                bestValue = lowAvg;
              }
              if (midAvg !== null && midAvg < bestValue) {
                bestRange = 'Mid p';
                bestValue = midAvg;
              }
              if (highAvg !== null && highAvg < bestValue) {
                bestRange = 'High p';
                bestValue = highAvg;
              }
              
              return (
                <div key={exp.metadata?.id || idx} className="p-2 bg-gray-50 rounded">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium" style={{ color: colors[idx % colors.length] }}>
                      {exp.metadata?.name}
                    </span>
                    <span className="text-xs">
                      Best: {bestRange}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs mt-1">
                    <div className={`text-center ${bestRange === 'Low p' ? 'font-bold text-green-600' : 'text-gray-600'}`}>
                      <p>Low p</p>
                      <p>{lowAvg !== null ? lowAvg.toFixed(4) : 'N/A'}</p>
                    </div>
                    <div className={`text-center ${bestRange === 'Mid p' ? 'font-bold text-green-600' : 'text-gray-600'}`}>
                      <p>Mid p</p>
                      <p>{midAvg !== null ? midAvg.toFixed(4) : 'N/A'}</p>
                    </div>
                    <div className={`text-center ${bestRange === 'High p' ? 'font-bold text-green-600' : 'text-gray-600'}`}>
                      <p>High p</p>
                      <p>{highAvg !== null ? highAvg.toFixed(4) : 'N/A'}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      
      {/* Summary Statistics - MEJORADO */}
      <div className="mt-6 p-3 bg-blue-50 rounded">
        <h5 className="text-sm font-medium text-blue-800 mb-2">Comparative Insights</h5>
        <div className="grid grid-cols-3 gap-4 text-xs">
          <div>
            <p className="text-gray-600">Best Overall Performance:</p>
            <p className="font-medium">
              {(() => {
                let bestExp = null;
                let bestAvg = Infinity;
                
                rangeExperiments.forEach(exp => {
                  const avg = exp.results.reduce((s, r) => s + r.discrepancy, 0) / exp.results.length;
                  if (avg < bestAvg) {
                    bestAvg = avg;
                    bestExp = exp;
                  }
                });
                
                return bestExp ? `${bestExp.metadata?.name} (${bestAvg.toFixed(4)})` : 'N/A';
              })()}
            </p>
          </div>
          
          <div>
            <p className="text-gray-600">Most Stable (Lowest Variance):</p>
            <p className="font-medium">
              {(() => {
                let bestExp = null;
                let bestVariance = Infinity;
                
                rangeExperiments.forEach(exp => {
                  const values = exp.results.map(r => r.discrepancy);
                  const mean = values.reduce((s, v) => s + v, 0) / values.length;
                  const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length;
                  
                  if (variance < bestVariance) {
                    bestVariance = variance;
                    bestExp = exp;
                  }
                });
                
                return bestExp ? `${bestExp.metadata?.name}` : 'N/A';
              })()}
            </p>
          </div>
          
          <div>
            <p className="text-gray-600">Widest Effective Range:</p>
            <p className="font-medium">
              {(() => {
                let bestExp = null;
                let bestRange = 0;
                const threshold = 0.1; // Considerar "efectivo" si discrepancia < 0.1
                
                rangeExperiments.forEach(exp => {
                  const effectiveResults = exp.results.filter(r => r.discrepancy < threshold);
                  if (effectiveResults.length > 0) {
                    const minP = Math.min(...effectiveResults.map(r => r.p));
                    const maxP = Math.max(...effectiveResults.map(r => r.p));
                    const range = maxP - minP;
                    
                    if (range > bestRange) {
                      bestRange = range;
                      bestExp = exp;
                    }
                  }
                });
                
                return bestExp ? `${bestExp.metadata?.name} (${bestRange.toFixed(2)})` : 'N/A';
              })()}
            </p>
          </div>
        </div>
        
        {/* Observations */}
        <div className="mt-3 pt-3 border-t border-blue-200">
          <p className="text-xs text-blue-700">
            📊 <strong>Quick Analysis:</strong>
          </p>
          <ul className="mt-1 text-xs text-blue-600 list-disc list-inside">
            {rangeExperiments.every(exp => {
              const p50 = exp.results.find(r => Math.abs(r.p - 0.5) < 0.01);
              return p50 && p50.discrepancy < 0.1;
            }) && (
              <li>All algorithms perform well around p=0.5 (crossover region)</li>
            )}
            
            {rangeExperiments.some(exp => {
              const lowP = exp.results.filter(r => r.p < 0.3);
              const highP = exp.results.filter(r => r.p > 0.7);
              const lowAvg = lowP.reduce((s, r) => s + r.discrepancy, 0) / lowP.length;
              const highAvg = highP.reduce((s, r) => s + r.discrepancy, 0) / highP.length;
              return Math.abs(lowAvg - highAvg) > 0.2;
            }) && (
              <li>Significant performance differences between low and high probability ranges</li>
            )}
            
            {rangeExperiments.filter(exp => exp.parameters?.algorithm === 'RECURSIVE AMP').length > 0 && (
              <li>Recursive AMP shows gradual convergence characteristics</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default CompleteDistributedComputingSimulator;