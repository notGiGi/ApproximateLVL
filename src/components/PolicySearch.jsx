import React, { useEffect, useMemo, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Scatter,
  Legend,
  Label
} from 'recharts';
import { SimulationEngine } from '../SimulationEngine.js';
import { getProcessColor } from '../utils/colors.js';

const DELIVERY_MODE_OPTIONS = [
  { id: 'standard', title: 'Standard' },
  { id: 'guaranteed', title: 'Guaranteed progress' },
  { id: 'process-dependent', title: 'Broadcast (process-dependent)' }
];

const OBJECTIVE_FUNCTIONS = [
  { id: 'mode', label: 'Mode (most frequent)' },
  { id: 'median', label: 'Median (rounded)' },
  { id: 'rounded-mean', label: 'Mean (rounded)' },
  { id: 'min', label: 'Min' },
  { id: 'max', label: 'Max' }
];

const BASE_RULES = [
  { id: 'AMP', label: 'AMP', algorithm: 'AMP', needsMeetingPoint: true },
  { id: 'RECURSIVE_AMP', label: 'Recursive AMP', algorithm: 'RECURSIVE AMP', needsMeetingPoint: true },
  { id: 'FV', label: 'Flip Value (FV)', algorithm: 'FV' },
  { id: 'COURTEOUS', label: 'Courteous', algorithm: 'COURTEOUS' },
  { id: 'MIN', label: 'Min', algorithm: 'MIN' },
  { id: 'LEADER', label: 'Leader', algorithm: 'LEADER', needsLeader: true },
  { id: 'SELFISH', label: 'Selfish (3p binary)', algorithm: 'SELFISH', requireThree: true, requireBinary: true },
  { id: 'CYCLIC', label: 'Cyclic (3p binary)', algorithm: 'CYCLIC', requireThree: true, requireBinary: true },
  { id: 'BIASED0', label: 'Biased0 (3p binary)', algorithm: 'BIASED0', requireThree: true, requireBinary: true }
];

const DEFAULT_MEETING_POINTS = [0.25, 0.5, 0.75];

const pKey = (p) => p.toFixed(4);

const shortRuleLabel = (rule) => {
  const alg = (rule.algorithm || rule.id || '').toUpperCase();
  const mp = rule.meetingPoint;
  const map = {
    'AMP': 'AMP',
    'RECURSIVE AMP': 'R-AMP',
    'FV': 'FV',
    'COURTEOUS': 'COUR',
    'MIN': 'MIN',
    'LEADER': 'LDR',
    'SELFISH': 'SELF',
    'CYCLIC': 'CYC',
    'BIASED0': 'B0'
  };
  const base = map[alg] || alg;
  if (rule.needsMeetingPoint && Number.isFinite(mp)) {
    return `${base}(${mp})`;
  }
  if (rule.needsLeader && Number.isFinite(rule.leaderIndex)) {
    return `${base}(P${rule.leaderIndex + 1})`;
  }
  return base;
};

const shortMode = (mode) => {
  if (mode === 'guaranteed') return 'guar';
  if (mode === 'process-dependent') return 'pd';
  return 'std';
};

const calculateDiscrepancy = (values) => {
  if (!Array.isArray(values) || values.length === 0) return 0;
  let maxDisc = 0;
  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      maxDisc = Math.max(maxDisc, Math.abs(values[i] - values[j]));
    }
  }
  return maxDisc;
};

const valuesAreBinary = (vals) => Array.isArray(vals) && vals.every((v) => v === 0 || v === 1);

const computeObjectiveValue = (values, objectiveId) => {
  const ints = values.map((v) => Math.round(v));
  if (ints.length === 0) return 0;

  switch (objectiveId) {
    case 'mode': {
      const counts = {};
      ints.forEach((v) => {
        counts[v] = (counts[v] || 0) + 1;
      });
      const entries = Object.entries(counts);
      entries.sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]));
      return parseInt(entries[0][0], 10);
    }
    case 'median': {
      const sorted = [...ints].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      const med = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
      return Math.round(med);
    }
    case 'rounded-mean': {
      const sum = ints.reduce((s, v) => s + v, 0);
      return Math.round(sum / ints.length);
    }
    case 'min':
      return Math.min(...ints);
    case 'max':
      return Math.max(...ints);
    default:
      return ints[0];
  }
};

const buildSequenceLabel = (sequence) =>
  sequence.map((rule) => rule.label || rule.algorithm || rule.id).join(' \u2192 ');

const buildShortSequenceLabel = (sequence, mode) => {
  const seq = sequence.map((rule) => shortRuleLabel(rule)).join(' → ');
  return `${seq} [${shortMode(mode)}]`;
};

const expandRuleCatalog = (selectedIds, meetingPoints, leaderIndex, processCount, binary) => {
  const mpList = meetingPoints.length > 0 ? meetingPoints : [0.5];
  const variants = [];

  selectedIds.forEach((id) => {
    const base = BASE_RULES.find((r) => r.id === id);
    if (!base) return;
    if (base.requireThree && processCount !== 3) return;
    if (base.requireBinary && !binary) return;

    if (base.needsMeetingPoint) {
      mpList.forEach((mp) => {
        variants.push({
          ...base,
          meetingPoint: mp,
          id: `${base.algorithm}@${mp}`,
          label: `${base.label} (a=${mp})`
        });
      });
    } else if (base.needsLeader) {
      variants.push({
        ...base,
        leaderIndex: leaderIndex ?? 0,
        id: `${base.algorithm}-L${(leaderIndex ?? 0) + 1}`,
        label: `${base.label} (P${(leaderIndex ?? 0) + 1})`
      });
    } else {
      variants.push({
        ...base,
        id: base.algorithm,
        label: base.label
      });
    }
  });

  return variants;
};

const generateSequences = (rules, depth, cap) => {
  const sequences = [];
  if (!rules.length) return sequences;

  const backtrack = (prefix, level) => {
    if (sequences.length >= cap) return;
    if (level === depth) {
      sequences.push(prefix);
      return;
    }
    for (const rule of rules) {
      backtrack([...prefix, rule], level + 1);
      if (sequences.length >= cap) break;
    }
  };

  backtrack([], 0);
  return sequences;
};

const buildPGrid = (minP, maxP, steps, allowZero) => {
  const arr = [];
  const step = steps > 0 ? (maxP - minP) / steps : 0;
  for (let i = 0; i <= steps; i++) {
    const p = minP + step * i;
    if (p < 0 || p > 1) continue;
    if (!allowZero && p <= 0) continue;
    arr.push(Number(p.toFixed(4)));
  }
  if (minP < 0.5 && maxP > 0.5 && !arr.some((x) => Math.abs(x - 0.5) < 1e-4)) {
    arr.push(0.5);
  }
  return Array.from(new Set(arr.sort((a, b) => a - b)));
};

export default function PolicySearch({
  baseProcessValues = [0, 1],
  defaultMeetingPoint = 0.5,
  selectedDeliveryModes = ['standard'],
  setSelectedDeliveryModes,
  deliveryMode = 'standard',
  setDeliveryMode,
  leaderIndex = 0,
  dimensionMode = 'binary',
  isActive = true
}) {
  const [initialValues, setInitialValues] = useState(baseProcessValues);
  const [roundHorizon, setRoundHorizon] = useState(3);
  const [repetitions, setRepetitions] = useState(100);
  const [pRange, setPRange] = useState({ min: 0.1, max: 0.9, steps: 12 });
  const [objectiveId, setObjectiveId] = useState('mode');
  const [selectedRuleIds, setSelectedRuleIds] = useState(['AMP', 'FV', 'MIN']);
  const [meetingPoints, setMeetingPoints] = useState(
    DEFAULT_MEETING_POINTS.includes(defaultMeetingPoint)
      ? [defaultMeetingPoint]
      : [defaultMeetingPoint, ...DEFAULT_MEETING_POINTS]
  );
  const [customMeetingPointInput, setCustomMeetingPointInput] = useState('');
  const [chartTopK, setChartTopK] = useState(5);
  const [tableLimit, setTableLimit] = useState(40);
  const [highlightBest, setHighlightBest] = useState(true);
  const [policyCap, setPolicyCap] = useState(180);
  const [chartHeightMode, setChartHeightMode] = useState('tall'); // tall | compact
  const [visiblePolicyIds, setVisiblePolicyIds] = useState([]);
  const [policyResults, setPolicyResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');

  useEffect(() => {
    setInitialValues(baseProcessValues);
  }, [JSON.stringify(baseProcessValues)]);

  const processCount = initialValues.length;
  const binary = valuesAreBinary(initialValues);

  const deliveryModesToUse = (selectedDeliveryModes && selectedDeliveryModes.length > 0)
    ? selectedDeliveryModes
    : [deliveryMode || 'standard'];

  const pValues = useMemo(() => {
    const hasGuaranteed = deliveryModesToUse.includes('guaranteed');
    return buildPGrid(pRange.min, pRange.max, pRange.steps, !hasGuaranteed);
  }, [pRange.min, pRange.max, pRange.steps, deliveryModesToUse]);

  const fallbackMeetingPoint = useMemo(() => {
    const mp = meetingPoints.find((v) => Number.isFinite(v) && v > 0);
    return Number.isFinite(mp) ? mp : defaultMeetingPoint || 0.5;
  }, [meetingPoints, defaultMeetingPoint]);

  const expandedRules = useMemo(
    () => expandRuleCatalog(selectedRuleIds, meetingPoints, leaderIndex, processCount, binary),
    [selectedRuleIds, meetingPoints, leaderIndex, processCount, binary]
  );

  const rawPolicyCount = useMemo(() => {
    if (!expandedRules.length) return 0;
    return Math.pow(expandedRules.length, roundHorizon) * deliveryModesToUse.length;
  }, [expandedRules, roundHorizon, deliveryModesToUse.length]);

  const sortedPolicies = useMemo(() => {
    return [...policyResults].sort(
      (a, b) =>
        b.averageSuccess - a.averageSuccess ||
        a.averageDiscrepancy - b.averageDiscrepancy
    );
  }, [policyResults]);

  const chartPolicies = useMemo(() => {
    const base = sortedPolicies.slice(0, Math.min(chartTopK, sortedPolicies.length));
    const byId = new Map(base.map((p) => [p.id, p]));
    visiblePolicyIds.forEach((id) => {
      const found = sortedPolicies.find((p) => p.id === id);
      if (found) byId.set(id, found);
    });
    return Array.from(byId.values());
  }, [sortedPolicies, chartTopK, visiblePolicyIds]);

  const tablePolicies = useMemo(() => {
    return sortedPolicies.slice(0, Math.min(tableLimit, sortedPolicies.length));
  }, [sortedPolicies, tableLimit]);

  useEffect(() => {
    setVisiblePolicyIds((prev) => {
      if (chartPolicies.length === 0) return [];
      if (prev.length === 0) return chartPolicies.map((p) => p.id);
      return prev;
    });
  }, [chartPolicies]);

  const bestPerP = useMemo(() => {
    const map = {};
    if (chartPolicies.length === 0) return map;
    const pList = chartPolicies[0].perP?.map((entry) => entry.p) || [];
    pList.forEach((p) => {
      let best = null;
      chartPolicies.forEach((policy) => {
        const entry = policy.perP.find((e) => Math.abs(e.p - p) < 1e-6);
        if (!entry) return;
        if (!best || entry.successRate > best.successRate) {
          best = {
            ...entry,
            policyLabel: policy.label,
            deliveryMode: policy.deliveryMode
          };
        }
      });
      if (best) {
        map[pKey(p)] = best;
      }
    });
    return map;
  }, [chartPolicies]);

  const chartData = useMemo(() => {
    if (chartPolicies.length === 0) return [];
    const pList = chartPolicies[0].perP?.map((entry) => entry.p) || [];
    return pList.map((p) => {
      const row = { p };
      chartPolicies.forEach((policy) => {
        const entry = policy.perP.find((e) => Math.abs(e.p - p) < 1e-6);
        row[policy.id] = entry ? entry.successRate : 0;
      });
      const best = bestPerP[pKey(p)];
      if (best) {
        row.best = best.successRate;
        row.bestLabel = `${best.policyLabel} [${best.deliveryMode}]`;
      }
      return row;
    });
  }, [chartPolicies, bestPerP]);

  const discrepancyChartData = useMemo(() => {
    if (chartPolicies.length === 0) return [];
    const pList = chartPolicies[0].perP?.map((entry) => entry.p) || [];
    return pList.map((p) => {
      const row = { p };
      chartPolicies.forEach((policy) => {
        const entry = policy.perP.find((e) => Math.abs(e.p - p) < 1e-6);
        row[policy.id] = entry ? entry.avgDiscrepancy : null;
      });
      return row;
    });
  }, [chartPolicies]);

  const visibleSet = useMemo(() => new Set(visiblePolicyIds), [visiblePolicyIds]);

  const toggleDeliveryMode = (modeId, checked) => {
    if (!setSelectedDeliveryModes) return;
    setSelectedDeliveryModes((prev) => {
      const prevModes = prev && prev.length ? prev : [deliveryMode || 'standard'];
      let next = prevModes;
      if (checked) {
        next = Array.from(new Set([...prevModes, modeId]));
      } else {
        next = prevModes.filter((m) => m !== modeId);
        if (next.length === 0) {
          next = ['standard'];
        }
      }
      if (setDeliveryMode) {
        setDeliveryMode(next[0]);
      }
      return next;
    });
  };

  const runSinglePolicyAtP = (sequence, baseValues, p, mode, targetValue) => {
    let successCount = 0;
    let discrepancySum = 0;
    let consensusRoundsSum = 0;
    let consensusHits = 0;

    for (let rep = 0; rep < repetitions; rep++) {
      const originalValues = [...baseValues];
      let values = [...baseValues];
      let knownValuesSets = null;
      let consensusRound = null;
      let lastDisc = calculateDiscrepancy(values);

      sequence.forEach((rule, idx) => {
        const currentRound = idx + 1;
        const beforeRound = [...values];
        const result = SimulationEngine.simulateRound(
          values,
          p,
          rule.algorithm,
          rule.meetingPoint ?? fallbackMeetingPoint,
          knownValuesSets,
          originalValues,
          mode,
          { leaderIndex: rule.leaderIndex ?? leaderIndex }
        );

        values = result.newValues;
        if ((rule.algorithm === 'MIN' || rule.algorithm === 'RECURSIVE AMP') && Array.isArray(result.knownValuesSets)) {
          knownValuesSets = result.knownValuesSets.map((set) => new Set(set));
        } else {
          knownValuesSets = null;
        }

        if (rule.algorithm === 'MIN' && currentRound < sequence.length) {
          values = beforeRound;
          lastDisc = calculateDiscrepancy(values);
        } else {
          lastDisc = typeof result.discrepancy === 'number'
            ? result.discrepancy
            : calculateDiscrepancy(values);
        }

        if (consensusRound === null && values.every((v) => Math.abs(v - values[0]) < 1e-6)) {
          consensusRound = currentRound;
        }
      });

      const isConsensus = values.every((v) => Math.abs(v - values[0]) < 1e-6);
      const correctConsensus = isConsensus && Math.abs(values[0] - targetValue) < 1e-6;

      if (correctConsensus) {
        successCount += 1;
        if (consensusRound != null) {
          consensusRoundsSum += consensusRound;
          consensusHits += 1;
        }
      }
      discrepancySum += lastDisc;
    }

    return {
      successRate: successCount / repetitions,
      avgDiscrepancy: discrepancySum / repetitions,
      avgConsensusRound: consensusHits > 0 ? consensusRoundsSum / consensusHits : null
    };
  };

  const runPolicySearch = async () => {
    if (dimensionMode !== 'binary') {
      setStatus('Policy search runs only in 1D. Switch to One-Dimension first.');
      return;
    }
    if (!expandedRules.length) {
      setStatus('Select at least one rule to build policies.');
      return;
    }
    if (pValues.length === 0) {
      setStatus('p-range is empty. Adjust min/max/steps.');
      return;
    }
    const sequences = generateSequences(expandedRules, roundHorizon, policyCap);
    if (sequences.length === 0) {
      setStatus('No policies generated with current filters.');
      return;
    }

    const policies = [];
    sequences.forEach((seq, idx) => {
      const seqId = seq.map((r) => r.id).join('->') || `policy-${idx}`;
      const seqLabel = buildSequenceLabel(seq);
      deliveryModesToUse.forEach((mode) => {
        policies.push({
          id: `${seqId}__${mode}`,
          baseId: seqId,
          sequence: seq,
          label: seqLabel,
          shortLabel: buildShortSequenceLabel(seq, mode),
          deliveryMode: mode
        });
      });
    });

    const targetValue = computeObjectiveValue(initialValues, objectiveId);
    const totalSteps = policies.length * pValues.length;
    const results = [];
    let completed = 0;

    setIsRunning(true);
    setProgress(0);
    setStatus(`Evaluating ${policies.length} policies on ${pValues.length} p points...`);

    for (const policy of policies) {
      const perP = [];
      for (const p of pValues) {
        const metrics = runSinglePolicyAtP(policy.sequence, initialValues, p, policy.deliveryMode, targetValue);
        perP.push({
          p,
          ...metrics,
          // Keep the p_algo_mode shape so we never override other runs
          key: `${p}_${policy.baseId}_${policy.deliveryMode}`
        });

        completed += 1;
        if (totalSteps > 0 && completed % 2 === 0) {
          setProgress(Math.min(100, Math.round((completed / totalSteps) * 100)));
          // Yield occasionally to keep UI responsive
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      const averageSuccess = perP.reduce((s, x) => s + x.successRate, 0) / perP.length;
      const averageDiscrepancy = perP.reduce((s, x) => s + x.avgDiscrepancy, 0) / perP.length;
      const averageConsensusRound = perP.reduce(
        (s, x) => s + (x.avgConsensusRound || roundHorizon),
        0
      ) / perP.length;

      results.push({
        ...policy,
        perP,
        averageSuccess,
        averageDiscrepancy,
        averageConsensusRound
      });
    }

    setPolicyResults(results);
    setProgress(100);
    setIsRunning(false);
    setStatus(`Done. Tested ${policies.length} policies (cap ${policyCap}), top-${Math.min(chartTopK, results.length)} shown below.`);
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <div className="flex flex-col xl:flex-row xl:items-start gap-8">
        <div className="xl:w-1/3 space-y-6">
          <div className="bg-white rounded-lg shadow p-4 space-y-2">
            <h3 className="text-lg font-semibold">Protocol Search</h3>
            <p className="text-sm text-gray-600">
              Build round by round rule sequences, then check how often they reach the right integer consensus
              under each delivery model.
            </p>
          </div>

          <div className="space-y-3 bg-white rounded-lg shadow p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Processes (n = {processCount})</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                className={`w-8 h-8 flex items-center justify-center rounded ${
                  processCount <= 2 || isRunning
                    ? 'bg-gray-200 text-gray-500'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
                onClick={() => {
                  if (processCount <= 2 || isRunning) return;
                  setInitialValues(initialValues.slice(0, -1));
                }}
                disabled={processCount <= 2 || isRunning}
              >
                −
              </button>
              <button
                className={`w-8 h-8 flex items-center justify-center rounded ${
                  isRunning ? 'bg-gray-200 text-gray-500' : 'bg-green-100 text-green-700 hover:bg-green-200'
                }`}
                onClick={() => {
                  if (isRunning) return;
                  const next = processCount % 2 === 0 ? 0 : 1;
                  setInitialValues([...initialValues, next]);
                }}
                disabled={isRunning}
              >
                +
              </button>
              <span className="text-xs text-gray-500">{binary ? 'Binary values' : 'Non-binary values'}</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {initialValues.map((val, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <span className="text-xs font-semibold text-gray-600">P{idx + 1}</span>
                  <input
                    type="number"
                    value={val}
                    onChange={(e) => {
                      if (isRunning) return;
                      const num = parseFloat(e.target.value);
                      const next = [...initialValues];
                      next[idx] = Number.isFinite(num) ? num : 0;
                      setInitialValues(next);
                    }}
                    className="w-full p-1 text-xs border border-gray-300 rounded"
                    disabled={isRunning}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 bg-white rounded-lg shadow p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Rounds  (R)</label>
                <input
                  type="number"
                  min="1"
                  value={roundHorizon}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setRoundHorizon(Math.max(1, Number.isFinite(val) ? val : 1));
                  }}
                  className="w-full p-2 text-sm border border-gray-300 rounded"
                  disabled={isRunning}
                />
                
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Repetitions</label>
                <input
                  type="number"
                  min="10"
                  max="1000"
                  value={repetitions}
                  onChange={(e) => setRepetitions(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full p-2 text-sm border border-gray-300 rounded"
                  disabled={isRunning}
                />
              
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">p min</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={pRange.min}
                  onChange={(e) => setPRange({ ...pRange, min: parseFloat(e.target.value) || 0 })}
                  className="w-full p-2 text-sm border border-gray-300 rounded"
                  disabled={isRunning}
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">p max</label>
                <input
                  type="number"
                  min="0"
                  max="1"
                  step="0.01"
                  value={pRange.max}
                  onChange={(e) => setPRange({ ...pRange, max: parseFloat(e.target.value) || 1 })}
                  className="w-full p-2 text-sm border border-gray-300 rounded"
                  disabled={isRunning}
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">p steps</label>
                <input
                  type="number"
                  min="2"
                  max="60"
                  value={pRange.steps}
                  onChange={(e) => setPRange({ ...pRange, steps: Math.max(2, parseInt(e.target.value, 10) || 2) })}
                  className="w-full p-2 text-sm border border-gray-300 rounded"
                  disabled={isRunning}
                />
              </div>
          </div>
        </div>

          <div className="space-y-3 bg-blue-50 border border-blue-200 rounded p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-blue-900">Consensus objective</p>
                <p className="text-xs text-blue-800">
                  Target value (computed): <span className="font-semibold">{computeObjectiveValue(initialValues, objectiveId)}</span>
              </p>
            </div>
            <div className="text-[11px] text-blue-700 bg-white/60 px-3 py-1 rounded">
              Choose how to validate “correct” consensus.
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {OBJECTIVE_FUNCTIONS.map((opt) => (
              <label key={opt.id} className={`flex items-center text-xs px-2 py-2 border rounded cursor-pointer ${objectiveId === opt.id ? 'bg-white shadow-sm border-blue-300' : 'bg-white/70'}`}>
                <input
                  type="radio"
                  className="mr-2"
                  value={opt.id}
                  checked={objectiveId === opt.id}
                  onChange={(e) => setObjectiveId(e.target.value)}
                  disabled={isRunning}
                />
                <span className="font-medium text-gray-700">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

          <div className="space-y-3 bg-white rounded-lg shadow p-4">
            <label className="text-xs font-semibold">Delivery models</label>
            <div className="space-y-1 bg-gray-50 p-2 rounded border border-gray-200">
              {DELIVERY_MODE_OPTIONS.map((mode) => (
                <label key={mode.id} className="flex items-center text-xs">
                  <input
                    type="checkbox"
                    className="mr-2"
                    checked={deliveryModesToUse.includes(mode.id)}
                    onChange={(e) => toggleDeliveryMode(mode.id, e.target.checked)}
                    disabled={isRunning}
                  />
                  <span>{mode.title}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3 bg-white rounded-lg shadow p-4">
            <label className="text-xs font-semibold">Rule catalog</label>
            <div className="grid grid-cols-2 gap-2">
              {BASE_RULES.map((rule) => {
                const disabled = (rule.requireThree && processCount !== 3) ||
                  (rule.requireBinary && !binary);
                return (
                  <label
                    key={rule.id}
                    className={`flex items-center text-xs border rounded p-2 ${disabled ? 'opacity-50' : 'hover:border-blue-300'}`}
                  >
                    <input
                      type="checkbox"
                      className="mr-2"
                      checked={selectedRuleIds.includes(rule.id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSelectedRuleIds((prev) => {
                          if (checked) return Array.from(new Set([...prev, rule.id]));
                          return prev.filter((r) => r !== rule.id);
                        });
                      }}
                      disabled={disabled || isRunning}
                    />
                    <span>{rule.label}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-500">
              3-player binary rules become available when n=3 and values are 0/1.
            </p>
          </div>

          <div className="space-y-3 bg-white rounded-lg shadow p-4">
            <label className="text-xs font-semibold">Meeting points (AMP / Recursive AMP)</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Enter values separated by commas (any > 0)"
                value={customMeetingPointInput}
                onChange={(e) => setCustomMeetingPointInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const nums = (customMeetingPointInput || '')
                      .split(',')
                      .map((s) => parseFloat(s.trim()))
                      .filter((n) => Number.isFinite(n) && n > 0);
                    if (nums.length) {
                      setMeetingPoints((prev) => Array.from(new Set([...prev, ...nums])));
                      setCustomMeetingPointInput('');
                    }
                  }
                }}
                className="flex-1 p-2 text-sm border border-gray-300 rounded"
                disabled={isRunning}
              />
              <button
                className="px-3 py-2 text-xs font-semibold rounded bg-blue-600 text-white hover:bg-blue-700"
                onClick={() => {
                  const nums = (customMeetingPointInput || '')
                    .split(',')
                    .map((s) => parseFloat(s.trim()))
                    .filter((n) => Number.isFinite(n) && n > 0);
                  if (nums.length) {
                    setMeetingPoints((prev) => Array.from(new Set([...prev, ...nums])));
                    setCustomMeetingPointInput('');
                  } else {
                    setStatus('Enter at least one meeting point greater than 0.');
                  }
                }}
                disabled={isRunning}
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {meetingPoints.map((mp) => (
                <span key={mp} className="px-2 py-1 text-xs bg-gray-100 border rounded flex items-center gap-1">
                  a={mp}
                  <button
                    className="text-gray-500 hover:text-red-600"
                    onClick={() => {
                      setMeetingPoints((prev) => {
                        const next = prev.filter((v) => v !== mp);
                        return next.length ? next : [mp];
                      });
                    }}
                    disabled={isRunning}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <p className="text-[11px] text-gray-500">
              First active value becomes the default meeting point. Any positive number works (decimals allowed).
            </p>
          </div>

          <div className="space-y-3 bg-white rounded-lg shadow p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold block mb-1">Chart top-k</label>
                <input
                  type="number"
                  min="1"
                  max="200"
                  value={chartTopK}
                  onChange={(e) => setChartTopK(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full p-2 text-sm border border-gray-300 rounded"
                  disabled={isRunning}
                />
                <p className="text-[11px] text-gray-500 mt-1">Controls how many policies feed the chart.</p>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Table limit</label>
                <input
                  type="number"
                  min="5"
                  max="400"
                  value={tableLimit}
                  onChange={(e) => setTableLimit(Math.max(5, parseInt(e.target.value, 10) || 5))}
                  className="w-full p-2 text-sm border border-gray-300 rounded"
                  disabled={isRunning}
                />
                <p className="text-[11px] text-gray-500 mt-1">How many rows to show in the table.</p>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Policy cap</label>
                <input
                  type="number"
                  min="50"
                  max="800"
                  value={policyCap}
                  onChange={(e) => setPolicyCap(Math.max(50, Math.min(800, parseInt(e.target.value, 10) || 50)))}
                  className="w-full p-2 text-sm border border-gray-300 rounded"
                  disabled={isRunning}
                />
                <p className="text-[11px] text-gray-500 mt-1">Limit generated combos to avoid blow-up.</p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={highlightBest}
                  onChange={(e) => setHighlightBest(e.target.checked)}
                  disabled={isRunning}
                />
                Highlight best per p
              </label>
              <div className="text-xs text-gray-600">Estimated combos: {rawPolicyCount.toLocaleString()}</div>
            </div>
            <div className="bg-white border rounded p-3 shadow-sm space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Generated protocols</p>
                  <p className="text-xs text-gray-500">
                    Cap set to {policyCap}. Increase with care if you need more coverage.
                  </p>
                </div>
                <button
                  onClick={runPolicySearch}
                  disabled={isRunning}
                  className={`px-4 py-2 text-sm font-semibold rounded-lg text-white shadow ${isRunning ? 'bg-gray-400' : 'bg-gradient-to-r from-green-600 to-emerald-500 hover:shadow-md'}`}
                >
                  {isRunning ? 'Running...' : 'Run Policy Search'}
                </button>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full" style={{ width: `${progress}%` }}></div>
              </div>
              <p className="text-xs text-gray-600">{status}</p>
            </div>
          </div>
        </div>

        <div className="xl:flex-1 space-y-6">
          <div className="bg-white rounded border p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold">Probability of correct consensus vs p</h4>
                <p className="text-xs text-gray-500">Select policies from the table to display their curves.</p>
              </div>
              <div className="text-right space-y-1">
                <span className="inline-flex items-center px-2 py-1 text-[11px] bg-blue-50 text-blue-800 rounded border border-blue-200">
                  Target consensus value: {computeObjectiveValue(initialValues, objectiveId)}
                </span>
                <span className="text-xs text-gray-500 block">
                  Showing {visiblePolicyIds.length} of {chartPolicies.length} charted policies (total {policyResults.length})
                </span>
              </div>
            </div>

            {chartPolicies.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-gray-500">
                Run policy search to see curves.
              </div>
            ) : (
              <div className={chartHeightMode === 'tall' ? 'h-[540px]' : 'h-88'}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartData}
                    margin={{ top: 20, right: 32, left: 90, bottom: 48 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="p"
                      tickFormatter={(v) => v.toFixed(2)}
                    >
                      <Label value="Delivery probability (p)" position="insideBottom" dy={14} />
                    </XAxis>
                    <YAxis
                      domain={[0, 1]}
                      tickFormatter={(v) => v.toFixed(1)}
                    >
                      <Label
                        value="Probability of correct consensus"
                        angle={-90}
                        position="insideLeft"
                        dx={-52}
                        style={{ textAnchor: 'middle' }}
                      />
                    </YAxis>
                    <Tooltip
                      wrapperStyle={{ fontSize: '12px' }}
                      formatter={(value, name, props) => {
                        if (name === 'best') {
                          return [value?.toFixed(3), props.payload.bestLabel || 'best'];
                        }
                        const policy = chartPolicies.find((p) => p.id === name);
                        return [value?.toFixed(3), policy ? `${policy.label} [${policy.deliveryMode}]` : name];
                      }}
                      labelFormatter={(v) => `p=${Number(v).toFixed(3)}`}
                    />
                  <Legend />
                    {chartPolicies.filter((policy) => visibleSet.has(policy.id)).map((policy, idx) => (
                      <Line
                        key={policy.id}
                        type="monotone"
                        dataKey={policy.id}
                        name={policy.shortLabel || `${policy.label} [${policy.deliveryMode}]`}
                        stroke={getProcessColor(idx)}
                        dot={false}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    ))}
                    {highlightBest && (
                      <Scatter dataKey="best" name="Best per p" fill="#111827" shape="circle" />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-white rounded border p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold">Average discrepancy vs p (lower is better)</h4>
                <p className="text-xs text-gray-500">Uses the same curve selection as the consensus chart.</p>
              </div>
            </div>

            {chartPolicies.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-sm text-gray-500">
                Run policy search to see curves.
              </div>
            ) : (
              <div className={chartHeightMode === 'tall' ? 'h-[540px]' : 'h-88'}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={discrepancyChartData}
                    margin={{ top: 20, right: 32, left: 90, bottom: 48 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis
                      dataKey="p"
                      tickFormatter={(v) => v.toFixed(2)}
                    >
                      <Label value="Delivery probability (p)" position="insideBottom" dy={14} />
                    </XAxis>
                    <YAxis
                      domain={[0, 'auto']}
                      tickFormatter={(v) => v.toFixed(2)}
                    >
                      <Label
                        value="Average discrepancy"
                        angle={-90}
                        position="insideLeft"
                        dx={-52}
                        style={{ textAnchor: 'middle' }}
                      />
                    </YAxis>
                    <Tooltip
                      wrapperStyle={{ fontSize: '12px' }}
                      formatter={(value, name) => {
                        const policy = chartPolicies.find((p) => p.id === name);
                        return [value?.toFixed(3), policy ? `${policy.label} [${policy.deliveryMode}]` : name];
                      }}
                      labelFormatter={(v) => `p=${Number(v).toFixed(3)}`}
                    />
                    <Legend />
                    {chartPolicies.filter((policy) => visibleSet.has(policy.id)).map((policy, idx) => (
                      <Line
                        key={policy.id}
                        type="monotone"
                        dataKey={policy.id}
                        name={policy.shortLabel || `${policy.label} [${policy.deliveryMode}]`}
                        stroke={getProcessColor(idx + 3)}
                        dot={false}
                        strokeWidth={2}
                        isAnimationActive={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-white border rounded p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">Policies table (sorted by avg success)</h4>
              <span className="text-xs text-gray-500">Showing {tablePolicies.length} of {sortedPolicies.length}</span>
            </div>
            {tablePolicies.length === 0 ? (
              <p className="text-sm text-gray-500">No results yet.</p>
            ) : (
              <div className="overflow-x-auto border rounded-lg">
                <table className="min-w-full text-xs divide-y divide-gray-200">
                  <thead className="bg-gray-100 text-gray-700">
                    <tr>
                      <th className="px-2 py-1 text-left">Chart</th>
                      <th className="px-2 py-1 text-left">Sequence</th>
                      <th className="px-2 py-1 text-left">Delivery</th>
                      <th className="px-2 py-1 text-right">Avg success</th>
                      <th className="px-2 py-1 text-right">Avg disc.</th>
                      <th className="px-2 py-1 text-right">Avg rounds</th>
                      <th className="px-2 py-1 text-right">Best p</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tablePolicies.map((policy, idx) => {
                      const bestEntry = policy.perP.reduce(
                        (best, cur) => {
                          if (!best || cur.successRate > best.successRate) return cur;
                          return best;
                        },
                        null
                      );
                      return (
                        <tr key={policy.id} className={`transition hover:bg-blue-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          <td className="px-2 py-1">
                            <input
                              type="checkbox"
                              checked={visibleSet.has(policy.id)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setVisiblePolicyIds((prev) => {
                                  if (checked) return Array.from(new Set([...prev, policy.id]));
                                  return prev.filter((id) => id !== policy.id);
                                });
                              }}
                            />
                          </td>
                          <td className="px-2 py-1">
                            <div className="font-semibold text-gray-800">{policy.shortLabel || policy.label}</div>
                            <div className="text-[11px] text-gray-500 truncate" title={policy.label}>
                              {policy.label}
                            </div>
                            <div className="text-[11px] text-gray-500">Rounds: {policy.sequence.length}</div>
                          </td>
                          <td className="px-2 py-1">{policy.deliveryMode}</td>
                          <td className="px-2 py-1 text-right">{policy.averageSuccess.toFixed(3)}</td>
                          <td className="px-2 py-1 text-right">{policy.averageDiscrepancy.toFixed(3)}</td>
                          <td className="px-2 py-1 text-right">
                            {policy.averageConsensusRound ? policy.averageConsensusRound.toFixed(2) : '—'}
                          </td>
                          <td className="px-2 py-1 text-right">
                            {bestEntry ? `p=${bestEntry.p.toFixed(2)} (${bestEntry.successRate.toFixed(2)})` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
