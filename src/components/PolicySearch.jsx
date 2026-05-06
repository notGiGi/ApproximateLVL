import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Label,
  ReferenceLine
} from 'recharts';
import { SimulationEngine } from '../SimulationEngine.js';
import { getProcessColor } from '../utils/colors.js';
import NumericTextInput from './NumericTextInput.jsx';

const DELIVERY_MODE_OPTIONS = [
  { id: 'standard', title: 'Standard' },
  { id: 'guaranteed', title: 'Guaranteed progress' },
  { id: 'process-dependent', title: 'Broadcast (process-dependent)' }
];

const BASE_RULES = [
  { id: 'AMP', label: 'AMP', algorithm: 'AMP', needsMeetingPoint: true },
  { id: 'RECURSIVE_AMP', label: 'Recursive AMP', algorithm: 'RECURSIVE AMP', needsMeetingPoint: true },
  { id: 'FV', label: 'Flip Value (FV)', algorithm: 'FV' },
  { id: 'COURTEOUS', label: 'Courteous', algorithm: 'COURTEOUS' },
  { id: 'PREF1', label: 'Pref1 (Broadcast model)', algorithm: 'PREF1', requireBinary: true },
  { id: 'PREF0', label: 'Pref0 (Broadcast model)', algorithm: 'PREF0', requireBinary: true },
  { id: 'MIN', label: 'Min', algorithm: 'MIN' },
  { id: 'LEADER', label: 'Leader', algorithm: 'LEADER', needsLeader: true },
  { id: 'SELFISH', label: 'Selfish (3p binary)', algorithm: 'SELFISH', requireThree: true, requireBinary: true },
  { id: 'CYCLIC', label: 'Cyclic (3p binary)', algorithm: 'CYCLIC', requireThree: true, requireBinary: true },
  { id: 'BIASED0', label: 'Biased0 (3p binary)', algorithm: 'BIASED0', requireThree: true, requireBinary: true }
];

const DEFAULT_MEETING_POINTS = [0.25, 0.5, 0.75];
const FIXED_STEPS = 100;

const shortRuleLabel = (rule) => {
  const alg = (rule.algorithm || rule.id || '').toUpperCase();
  const mp = rule.meetingPoint;
  const map = {
    'AMP': 'AMP',
    'RECURSIVE AMP': 'R-AMP',
    'FV': 'FV',
    'COURTEOUS': 'COUR',
    'PREF1': 'P1',
    'PREF0': 'P0',
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

const modeBadgeClass = (mode) => {
  if (mode === 'guaranteed') return 'bg-green-100 text-green-800 border border-green-200';
  if (mode === 'process-dependent') return 'bg-purple-100 text-purple-800 border border-purple-200';
  return 'bg-gray-100 text-gray-800 border border-gray-200';
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

const computeMajorityValue = (values) => {
  const ints = values.map((v) => Math.round(v));
  if (ints.length === 0) return 0;
  const counts = {};
  ints.forEach((v) => {
    counts[v] = (counts[v] || 0) + 1;
  });
  const entries = Object.entries(counts);
  entries.sort((a, b) => b[1] - a[1] || Number(a[0]) - Number(b[0]));
  return parseInt(entries[0][0], 10);
};

const buildSequenceLabel = (sequence) =>
  sequence.map((rule) => rule.label || rule.algorithm || rule.id).join(' \u2192 ');

const buildShortSequenceLabel = (sequence, mode) => {
  const seq = sequence.map((rule) => shortRuleLabel(rule)).join(' \u2192 ');
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

const PREF0_RULE = { algorithm: 'PREF0', id: 'PREF0', label: 'PREF0' };
const PREF1_RULE = { algorithm: 'PREF1', id: 'PREF1', label: 'PREF1' };
const COURTEOUS_RULE = { algorithm: 'COURTEOUS', id: 'COURTEOUS', label: 'COURTEOUS' };

const PREDEFINED_SEQUENCE_OPTIONS = [
  {
    id: 'sweep',
    name: 'SWEEP',
    notation: 'PREF0 \u2192 PREF1',
    description: '2-round. Error q^n. Broadcast-optimal.',
    sequence: [PREF0_RULE, PREF1_RULE],
    sweepRepetitions: 1
  },
  {
    id: 'sweep-x2',
    name: 'SWEEP x2',
    notation: 'PREF0 \u2192 PREF1 \u2192 PREF0 \u2192 PREF1',
    description: '4-round. Error q^(2n).',
    sequence: [PREF0_RULE, PREF1_RULE, PREF0_RULE, PREF1_RULE],
    sweepRepetitions: 2
  },
  {
    id: 'sweep-x3',
    name: 'SWEEP x3',
    notation: 'PREF0 \u2192 PREF1 \u2192 PREF0 \u2192 PREF1 \u2192 PREF0 \u2192 PREF1',
    description: '6-round. Error q^(3n).',
    sequence: [PREF0_RULE, PREF1_RULE, PREF0_RULE, PREF1_RULE, PREF0_RULE, PREF1_RULE],
    sweepRepetitions: 3
  },
  {
    id: 'courteous-x2',
    name: 'Repeat COURTEOUS x2',
    notation: 'COURTEOUS \u2192 COURTEOUS',
    description: '2 rounds of courteous.',
    sequence: [COURTEOUS_RULE, COURTEOUS_RULE]
  },
  {
    id: 'courteous-x3',
    name: 'Repeat COURTEOUS x3',
    notation: 'COURTEOUS \u2192 COURTEOUS \u2192 COURTEOUS',
    description: '3 rounds of courteous.',
    sequence: [COURTEOUS_RULE, COURTEOUS_RULE, COURTEOUS_RULE]
  },
  {
    id: 'pref1-x2',
    name: 'Repeat PREF1 x2',
    notation: 'PREF1 \u2192 PREF1',
    description: 'Is repeating optimal? Compare with SWEEP.',
    sequence: [PREF1_RULE, PREF1_RULE]
  },
  {
    id: 'pref1-x3',
    name: 'Repeat PREF1 x3',
    notation: 'PREF1 \u2192 PREF1 \u2192 PREF1',
    description: 'Three rounds of PREF1.',
    sequence: [PREF1_RULE, PREF1_RULE, PREF1_RULE]
  },
  {
    id: 'courteous-pref1',
    name: 'COURTEOUS \u2192 PREF1',
    notation: 'COURTEOUS \u2192 PREF1',
    description: 'Switch at round 2.',
    sequence: [COURTEOUS_RULE, PREF1_RULE]
  },
  {
    id: 'pref0-courteous-pref1',
    name: 'PREF0 \u2192 COURTEOUS \u2192 PREF1',
    notation: 'PREF0 \u2192 COURTEOUS \u2192 PREF1',
    description: '3-round mixed.',
    sequence: [PREF0_RULE, COURTEOUS_RULE, PREF1_RULE]
  }
];

const TARGET_REGIME_POINTS = [0.3, 0.5, 0.7];
// [PREF0, PREF1] = 1 SWEEP (2 internal rounds, error = q^n)
// [PREF0, PREF1, PREF0, PREF1] = 2 SWEEPs (4 rounds, error = q^(2n))
const EXPLORER_RULES = [
  { id: 'COURTEOUS', algorithm: 'COURTEOUS', label: 'C' },
  { id: 'PREF0', algorithm: 'PREF0', label: 'P0', requireBinary: true },
  { id: 'PREF1', algorithm: 'PREF1', label: 'P1', requireBinary: true }
];
const EXPLORER_DELIVERY_MODE = 'process-dependent';
const EXPLORER_SEQUENCE_LENGTH_OPTIONS = [1, 2, 3, 4];
const EXPLORER_REFERENCE_POINTS = [0, 1 / 3, 1 / 2, 2 / 3, 1];
const EXPLORER_SWEEP_LABEL = 'P0 \u2192 P1';
const EXPLORER_COLOR_FAMILIES = {
  courteousOnly: { hue: 214, saturation: 78, lightnessRange: [38, 72] },
  pref0Start: { hue: 142, saturation: 62, lightnessRange: [32, 66] },
  pref1Start: { hue: 28, saturation: 88, lightnessRange: [38, 70] },
  mixed: { hue: 276, saturation: 62, lightnessRange: [38, 72] }
};

const sequenceContainsAlgorithm = (sequence, algorithm) =>
  Array.isArray(sequence) && sequence.some((rule) => rule.algorithm === algorithm);

const getExplorerSequenceCategory = (sequence) => {
  const algorithms = Array.isArray(sequence) ? sequence.map((rule) => rule.algorithm) : [];
  if (!algorithms.length) return 'mixed';
  if (algorithms.every((algorithm) => algorithm === 'COURTEOUS')) return 'courteousOnly';
  if (algorithms[0] === 'PREF0') return 'pref0Start';
  if (algorithms[0] === 'PREF1') return 'pref1Start';
  return 'mixed';
};

const buildExplorerSequenceColor = (category, index, total) => {
  const family = EXPLORER_COLOR_FAMILIES[category] || EXPLORER_COLOR_FAMILIES.mixed;
  const [minLightness, maxLightness] = family.lightnessRange;
  const ratio = total <= 1 ? 0.5 : index / (total - 1);
  const lightness = minLightness + (maxLightness - minLightness) * ratio;
  return `hsl(${family.hue} ${family.saturation}% ${lightness}%)`;
};

const escapeCsvValue = (value) => {
  const text = String(value ?? '');
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const interpolatePerPValue = (perP, target, key) => {
  if (!Array.isArray(perP) || perP.length === 0) return null;
  const sorted = [...perP]
    .filter((entry) => typeof entry?.p === 'number' && typeof entry?.[key] === 'number')
    .sort((a, b) => a.p - b.p);
  if (sorted.length === 0) return null;

  for (const entry of sorted) {
    if (Math.abs(entry.p - target) < 1e-9) {
      return entry[key];
    }
  }

  if (target <= sorted[0].p) return sorted[0][key];
  if (target >= sorted[sorted.length - 1].p) return sorted[sorted.length - 1][key];

  for (let index = 1; index < sorted.length; index += 1) {
    const prev = sorted[index - 1];
    const current = sorted[index];
    if (target < prev.p || target > current.p) continue;
    const span = current.p - prev.p;
    if (span === 0) return current[key];
    const ratio = (target - prev.p) / span;
    return prev[key] + (current[key] - prev[key]) * ratio;
  }

  return null;
};

const findCrossoverWithFunction = (perP, fn, key) => {
  if (!Array.isArray(perP) || perP.length < 2) return null;
  const points = perP
    .filter((entry) => typeof entry?.p === 'number' && typeof entry?.[key] === 'number')
    .map((entry) => ({
      p: entry.p,
      diff: entry[key] - fn(entry.p)
    }))
    .sort((a, b) => a.p - b.p);

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    if (Math.abs(current.diff) < 1e-9) {
      return current.p;
    }
    if (index === 0) continue;
    const previous = points[index - 1];
    if ((previous.diff < 0 && current.diff > 0) || (previous.diff > 0 && current.diff < 0)) {
      const ratio = previous.diff / (previous.diff - current.diff);
      return previous.p + (current.p - previous.p) * ratio;
    }
  }

  return null;
};

const findCrossoverBetweenSeries = (seriesA, seriesB, key) => {
  if (!Array.isArray(seriesA) || !Array.isArray(seriesB) || seriesA.length < 2 || seriesB.length < 2) {
    return null;
  }

  const byP = new Map();
  seriesB.forEach((entry) => {
    if (typeof entry?.p === 'number' && typeof entry?.[key] === 'number') {
      byP.set(Number(entry.p.toFixed(6)), entry[key]);
    }
  });

  const aligned = seriesA
    .filter((entry) => typeof entry?.p === 'number' && typeof entry?.[key] === 'number')
    .map((entry) => {
      const other = byP.get(Number(entry.p.toFixed(6)));
      if (typeof other !== 'number') return null;
      return { p: entry.p, diff: entry[key] - other };
    })
    .filter(Boolean)
    .sort((a, b) => a.p - b.p);

  for (let index = 0; index < aligned.length; index += 1) {
    const current = aligned[index];
    if (Math.abs(current.diff) < 1e-9) {
      return current.p;
    }
    if (index === 0) continue;
    const previous = aligned[index - 1];
    if ((previous.diff < 0 && current.diff > 0) || (previous.diff > 0 && current.diff < 0)) {
      const ratio = previous.diff / (previous.diff - current.diff);
      return previous.p + (current.p - previous.p) * ratio;
    }
  }

  return null;
};

const formatCrossover = (value, perP, theoryFn) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `p \u2248 ${value.toFixed(3)}`;
  }
  if (!Array.isArray(perP) || perP.length === 0) return '\u2014';
  const diffs = perP
    .filter((entry) => typeof entry?.p === 'number' && typeof entry?.avgDiscrepancy === 'number')
    .map((entry) => entry.avgDiscrepancy - theoryFn(entry.p));
  if (diffs.length === 0) return '\u2014';
  if (diffs.every((diff) => diff <= 0)) return 'Always below';
  if (diffs.every((diff) => diff >= 0)) return 'Always above';
  return '\u2014';
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
  const [builderMode, setBuilderMode] = useState('predefined');
  const [sequenceLength, setSequenceLength] = useState(3);
  const [repetitions, setRepetitions] = useState(100);
  const [pRange, setPRange] = useState({ min: 0.1, max: 0.9, steps: FIXED_STEPS });
  const [selectedPredefinedIds, setSelectedPredefinedIds] = useState(['sweep']);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [selectedRuleIds, setSelectedRuleIds] = useState(['AMP', 'FV', 'MIN']);
  const [meetingPoints, setMeetingPoints] = useState(
    DEFAULT_MEETING_POINTS.includes(defaultMeetingPoint)
      ? [defaultMeetingPoint]
      : [defaultMeetingPoint, ...DEFAULT_MEETING_POINTS]
  );
  const [customMeetingPointInput, setCustomMeetingPointInput] = useState('');
  const [policyCap, setPolicyCap] = useState(180);
  const [visibleSequenceIds, setVisibleSequenceIds] = useState([]);
  const visibleInitRef = useRef(false);
  const cancelRef = useRef(false);
  const [sequenceResults, setSequenceResults] = useState([]);
  const [explorerMode, setExplorerMode] = useState('custom');
  const [explorerSequenceLength, setExplorerSequenceLength] = useState(2);
  const [explorerInitialValues, setExplorerInitialValues] = useState([0, 0, 1]);
  const [explorerRepetitions, setExplorerRepetitions] = useState(500);
  const [explorerResults, setExplorerResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [inspectorP, setInspectorP] = useState(null);
  const [highlightedPolicyId, setHighlightedPolicyId] = useState(null);
  const previousExplorerModeRef = useRef('custom');
  const lastCustomRepetitionsRef = useRef(100);

  const yieldEvery = 20;

  const maybeYield = async (step = 0) => {
    if (document?.hidden) return;
    if (step % yieldEvery === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  };

  void isActive;

  useEffect(() => {
    setInitialValues(baseProcessValues);
  }, [JSON.stringify(baseProcessValues)]);

  useEffect(() => {
    const previousMode = previousExplorerModeRef.current;
    if (previousMode !== explorerMode) {
      if (explorerMode === 'optimal') {
        lastCustomRepetitionsRef.current = repetitions;
        if (repetitions !== explorerRepetitions) {
          setRepetitions(explorerRepetitions);
        }
      } else if (repetitions !== lastCustomRepetitionsRef.current) {
        setRepetitions(lastCustomRepetitionsRef.current);
      }
      previousExplorerModeRef.current = explorerMode;
      return;
    }

    if (explorerMode === 'custom') {
      lastCustomRepetitionsRef.current = repetitions;
      return;
    }

    if (repetitions !== explorerRepetitions) {
      setRepetitions(explorerRepetitions);
    }
  }, [explorerMode, explorerRepetitions, repetitions]);

  const processCount = initialValues.length;
  const explorerN = explorerInitialValues.length;
  const binary = valuesAreBinary(initialValues);

  const deliveryModesToUse = (selectedDeliveryModes && selectedDeliveryModes.length > 0)
    ? selectedDeliveryModes
    : [deliveryMode || 'standard'];

  const pValues = useMemo(() => {
    const hasGuaranteed = deliveryModesToUse.includes('guaranteed');
    return buildPGrid(pRange.min, pRange.max, pRange.steps, !hasGuaranteed);
  }, [pRange.min, pRange.max, pRange.steps, deliveryModesToUse]);

  const fallbackMeetingPoint = useMemo(() => {
    const mp = meetingPoints.find((value) => Number.isFinite(value) && value > 0);
    return Number.isFinite(mp) ? mp : defaultMeetingPoint || 0.5;
  }, [meetingPoints, defaultMeetingPoint]);

  const selectedPredefinedSequences = useMemo(
    () => PREDEFINED_SEQUENCE_OPTIONS.filter((option) => selectedPredefinedIds.includes(option.id)),
    [selectedPredefinedIds]
  );

  const expandedRules = useMemo(
    () => expandRuleCatalog(selectedRuleIds, meetingPoints, leaderIndex, processCount, binary),
    [selectedRuleIds, meetingPoints, leaderIndex, processCount, binary]
  );

  const rawSequenceCount = useMemo(() => {
    if (!expandedRules.length) return 0;
    return Math.pow(expandedRules.length, sequenceLength) * deliveryModesToUse.length;
  }, [expandedRules, sequenceLength, deliveryModesToUse.length]);

  useEffect(() => {
    if (sequenceResults.length === 0) {
      setVisibleSequenceIds([]);
      return;
    }

    const defaultVisibleIds = builderMode === 'predefined'
      ? sequenceResults.map((result) => result.id)
      : sequenceResults.slice(0, Math.min(8, sequenceResults.length)).map((result) => result.id);

    if (!visibleInitRef.current) {
      visibleInitRef.current = true;
      setVisibleSequenceIds(defaultVisibleIds);
      return;
    }

    setVisibleSequenceIds((prev) => {
      const existing = prev.filter((id) => sequenceResults.some((result) => result.id === id));
      return existing.length > 0 ? existing : defaultVisibleIds;
    });
  }, [sequenceResults, builderMode]);

  useEffect(() => {
    setHighlightedPolicyId(null);
  }, [sequenceResults]);

  const visibleSet = useMemo(() => new Set(visibleSequenceIds), [visibleSequenceIds]);

  const chartSequences = useMemo(
    () => sequenceResults.filter((result) => visibleSet.has(result.id)),
    [sequenceResults, visibleSet]
  );

  const sweepTheorySeries = useMemo(() => {
    const repetitions = Array.from(new Set(
      sequenceResults
        .map((result) => result.sweepRepetitions)
        .filter((value) => Number.isFinite(value) && value > 0)
    )).sort((a, b) => a - b);

    return repetitions.map((sweepRepetitions) => ({
      dataKey: `sweepTheory${sweepRepetitions}`,
      sweepRepetitions,
      name: sweepRepetitions === 1
        ? 'SWEEP theory (q^n) - exact under broadcast, upper bound under standard delivery'
        : `SWEEP x${sweepRepetitions} theory (q^(${sweepRepetitions}n))`,
      stroke: sweepRepetitions === 1 ? '#111827' : sweepRepetitions === 2 ? '#4b5563' : '#6b7280',
      dash: sweepRepetitions === 1 ? '7 5' : sweepRepetitions === 2 ? '4 4' : '2 3'
    }));
  }, [sequenceResults]);

  const chartData = useMemo(() => {
    if (chartSequences.length === 0) return [];
    return pValues.map((p) => {
      const row = { p };
      chartSequences.forEach((result) => {
        const entry = result.perP.find((item) => Math.abs(item.p - p) < 1e-6);
        row[result.id] = entry ? entry.avgDiscrepancy : null;
      });
      sweepTheorySeries.forEach((series) => {
        row[series.dataKey] = Math.pow(1 - p, processCount * series.sweepRepetitions);
      });
      return row;
    });
  }, [chartSequences, pValues, processCount, sweepTheorySeries]);

  const resultsTableRows = useMemo(() => {
    const sweepTheory = (p) => Math.pow(1 - p, processCount);
    return sequenceResults.map((result) => {
      const crossover = findCrossoverWithFunction(result.perP, sweepTheory, 'avgDiscrepancy');
      return {
        ...result,
        regimeSamples: TARGET_REGIME_POINTS.reduce((acc, point) => {
          acc[point] = interpolatePerPValue(result.perP, point, 'avgDiscrepancy');
          return acc;
        }, {}),
        sweepTheoryLabel: formatCrossover(crossover, result.perP, sweepTheory)
      };
    });
  }, [sequenceResults, processCount]);

  const courteousPref1Crossover = useMemo(() => {
    const pureCourteous = sequenceResults
      .filter((result) => result.sequence.every((rule) => rule.algorithm === 'COURTEOUS'))
      .sort((a, b) => a.sequence.length - b.sequence.length);
    const purePref1 = sequenceResults
      .filter((result) => result.sequence.every((rule) => rule.algorithm === 'PREF1'))
      .sort((a, b) => a.sequence.length - b.sequence.length);

    if (!pureCourteous.length || !purePref1.length) return null;

    let courteousSequence = null;
    let pref1Sequence = null;

    for (const courteousCandidate of pureCourteous) {
      const match = purePref1.find((pref1Candidate) =>
        pref1Candidate.deliveryMode === courteousCandidate.deliveryMode &&
        pref1Candidate.sequence.length === courteousCandidate.sequence.length
      );
      if (match) {
        courteousSequence = courteousCandidate;
        pref1Sequence = match;
        break;
      }
    }

    if (!courteousSequence || !pref1Sequence) {
      courteousSequence = pureCourteous[0];
      pref1Sequence = purePref1.find((result) => result.deliveryMode === courteousSequence.deliveryMode) || purePref1[0];
    }

    return {
      courteousSequence,
      pref1Sequence,
      value: findCrossoverBetweenSeries(courteousSequence.perP, pref1Sequence.perP, 'avgDiscrepancy')
    };
  }, [sequenceResults]);

  const showTwoThirdsReference = processCount === 3 && sequenceResults.some((result) =>
    sequenceContainsAlgorithm(result.sequence, 'COURTEOUS') || sequenceContainsAlgorithm(result.sequence, 'PREF1')
  );

  const explorerPValues = useMemo(() => {
    const base = buildPGrid(0, 1, FIXED_STEPS, false);
    return base.length > 0 && Math.abs(base[0]) < 1e-9 ? base : [0, ...base];
  }, []);

  const explorerColorByLabel = useMemo(() => {
    if (explorerResults.length === 0) return {};
    const grouped = {
      courteousOnly: [],
      pref0Start: [],
      pref1Start: [],
      mixed: []
    };

    explorerResults.forEach((result) => {
      const category = getExplorerSequenceCategory(result.sequence);
      grouped[category].push(result.label);
    });

    return Object.values(grouped).reduce((acc, labels) => {
      labels
        .sort((a, b) => a.localeCompare(b))
        .forEach((label, index) => {
          const category = explorerResults.find((result) => result.label === label)?.colorCategory || 'mixed';
          acc[label] = buildExplorerSequenceColor(category, index, labels.length);
        });
      return acc;
    }, {});
  }, [explorerResults]);

  const explorerChartData = useMemo(() => {
    if (explorerResults.length === 0) return [];

    return explorerPValues.map((p) => {
      const row = {
        p,
        empiricalOptimal: null,
        oneRoundOptimalTheory: p <= 2 / 3
          ? (2 * p * p * (1 - p)) + Math.pow(1 - p, 3)
          : 1 - p
      };
      let bestValue = Infinity;

      explorerResults.forEach((result) => {
        const entry = result.perP.find((item) => Math.abs(item.p - p) < 1e-6);
        const value = entry ? entry.avgDiscrepancy : null;
        row[result.id] = value;
        if (typeof value === 'number' && value < bestValue) {
          bestValue = value;
        }
      });

      if (explorerSequenceLength >= 2) {
        row.sweepTheory = Math.pow(1 - p, explorerN);
      }
      row.empiricalOptimal = Number.isFinite(bestValue) ? bestValue : null;
      return row;
    });
  }, [explorerN, explorerPValues, explorerResults, explorerSequenceLength]);

  const explorerOptimalBand = useMemo(() => {
    if (explorerResults.length === 0) return [];

    return explorerPValues.map((p, index) => {
      let winningResult = null;
      let winningValue = Infinity;

      explorerResults.forEach((result) => {
        const entry = result.perP.find((item) => Math.abs(item.p - p) < 1e-6);
        if (!entry || typeof entry.avgDiscrepancy !== 'number') return;
        if (entry.avgDiscrepancy < winningValue) {
          winningValue = entry.avgDiscrepancy;
          winningResult = result;
        }
      });

      return {
        index,
        p,
        label: winningResult?.label || '',
        color: winningResult ? explorerColorByLabel[winningResult.label] : '#d1d5db',
        avgDiscrepancy: Number.isFinite(winningValue) ? winningValue : null
      };
    });
  }, [explorerColorByLabel, explorerPValues, explorerResults]);

  const explorerBandLegend = useMemo(() => {
    const labels = [];
    explorerOptimalBand.forEach((segment) => {
      if (segment.label && !labels.includes(segment.label)) {
        labels.push(segment.label);
      }
    });

    return labels.map((label) => ({
      label,
      color: explorerColorByLabel[label] || '#6b7280'
    }));
  }, [explorerColorByLabel, explorerOptimalBand]);

  const explorerResultsTableRows = useMemo(() => (
    [...explorerResults]
      .map((result) => ({
        ...result,
        regimeSamples: TARGET_REGIME_POINTS.reduce((acc, point) => {
          acc[point] = interpolatePerPValue(result.perP, point, 'avgDiscrepancy');
          return acc;
        }, {})
      }))
      .sort((a, b) => a.averageDiscrepancy - b.averageDiscrepancy)
  ), [explorerResults]);

  const explorerSweepBeatCount = useMemo(() => {
    if (explorerChartData.length === 0) return 0;
    return explorerChartData.reduce((count, row) => {
      if (typeof row.empiricalOptimal !== 'number') return count;
      const ed = row.empiricalOptimal;
      const sweepTheory = Math.pow(1 - row.p, explorerN);
      const se = Math.sqrt(ed * (1 - ed) / explorerRepetitions);
      const beatsThreshold = Math.max(3 * se, 0.005);
      return ed < sweepTheory - beatsThreshold ? count + 1 : count;
    }, 0);
  }, [explorerChartData, explorerN, explorerRepetitions]);

  const inspectorRows = useMemo(() => {
    if (inspectorP == null || explorerResults.length === 0) return [];

    return explorerResults
      .map((result) => {
        const closestEntry = result.perP.reduce((closest, entry) => {
          if (!closest) return entry;
          return Math.abs(entry.p - inspectorP) < Math.abs(closest.p - inspectorP) ? entry : closest;
        }, null);

        return closestEntry
          ? {
              id: result.id,
              label: result.label,
              avgDiscrepancy: closestEntry.avgDiscrepancy
            }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.avgDiscrepancy - b.avgDiscrepancy);
  }, [explorerResults, inspectorP]);

  const toggleDeliveryMode = (modeId, checked) => {
    if (!setSelectedDeliveryModes) return;
    setSelectedDeliveryModes((prev) => {
      const prevModes = prev && prev.length ? prev : [deliveryMode || 'standard'];
      let next = prevModes;
      if (checked) {
        next = Array.from(new Set([...prevModes, modeId]));
      } else {
        next = prevModes.filter((mode) => mode !== modeId);
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

  const runSinglePolicyAtP = (sequence, baseValues, p, mode, validityCriterion, majorityValue, sampleCount = repetitions) => {
    let successCount = 0;
    let discrepancySum = 0;
    let consensusRoundsSum = 0;
    let consensusHits = 0;

    for (let rep = 0; rep < sampleCount; rep++) {
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
      const consensusValue = Math.round(values[0]);
      const validByCriterion = validityCriterion === 'majority'
        ? consensusValue === majorityValue
        : baseValues.some((v) => Math.round(v) === consensusValue);
      const correctConsensus = isConsensus && validByCriterion;

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
      successRate: successCount / sampleCount,
      avgDiscrepancy: discrepancySum / sampleCount,
      avgConsensusRound: consensusHits > 0 ? consensusRoundsSum / consensusHits : null
    };
  };

  const runSequenceComparison = async () => {
    if (dimensionMode !== 'binary') {
      setStatus('Sequence comparison runs only in 1D. Switch to One-Dimension first.');
      return;
    }
    if (builderMode === 'predefined' && selectedPredefinedSequences.length === 0) {
      setStatus('Select at least one predefined sequence.');
      return;
    }
    if (builderMode === 'custom' && !expandedRules.length) {
      setStatus('Select at least one building block for the custom builder.');
      return;
    }
    if (pValues.length === 0) {
      setStatus('p-range is empty. Adjust min/max/steps.');
      return;
    }

    const sequenceDefinitions = [];

    if (builderMode === 'predefined') {
      selectedPredefinedSequences.forEach((option) => {
        deliveryModesToUse.forEach((mode) => {
          sequenceDefinitions.push({
            id: `${option.id}__${mode}`,
            baseId: option.id,
            sequence: option.sequence.map((rule) => ({ ...rule })),
            label: option.name,
            notation: option.notation,
            description: option.description,
            shortLabel: `${option.name} [${shortMode(mode)}]`,
            deliveryMode: mode,
            sweepRepetitions: option.sweepRepetitions || null
          });
        });
      });
    } else {
      const generatedSequences = generateSequences(expandedRules, sequenceLength, policyCap);
      if (generatedSequences.length === 0) {
        setStatus('No sequences generated with current builder settings.');
        return;
      }

      generatedSequences.forEach((sequence, index) => {
        const sequenceId = sequence.map((rule) => rule.id).join('->') || `sequence-${index}`;
        const notation = buildSequenceLabel(sequence);
        deliveryModesToUse.forEach((mode) => {
          sequenceDefinitions.push({
            id: `${sequenceId}__${mode}`,
            baseId: sequenceId,
            sequence,
            label: notation,
            notation,
            description: 'Generated by the custom builder.',
            shortLabel: buildShortSequenceLabel(sequence, mode),
            deliveryMode: mode,
            sweepRepetitions: null
          });
        });
      });
    }

    const majorityValue = computeMajorityValue(initialValues);
    const totalSteps = sequenceDefinitions.length * pValues.length;
    const results = [];
    let completed = 0;

    cancelRef.current = false;
    setIsRunning(true);
    setProgress(0);
    setStatus(`Evaluating ${sequenceDefinitions.length} sequences on ${pValues.length} p points...`);

    for (const sequenceDefinition of sequenceDefinitions) {
      if (cancelRef.current) break;
      const perP = [];

      for (const p of pValues) {
        if (cancelRef.current) break;
        const metrics = runSinglePolicyAtP(
          sequenceDefinition.sequence,
          initialValues,
          p,
          sequenceDefinition.deliveryMode,
          'proposed',
          majorityValue,
          repetitions
        );

        perP.push({
          p,
          ...metrics,
          key: `${p}_${sequenceDefinition.baseId}_${sequenceDefinition.deliveryMode}`
        });

        completed += 1;
        if (totalSteps > 0 && completed % 10 === 0) {
          setProgress(Math.min(100, Math.round((completed / totalSteps) * 100)));
          await maybeYield(completed);
        }
      }

      if (perP.length > 0) {
        const averageAgreement = perP.reduce((sum, entry) => sum + entry.successRate, 0) / perP.length;
        const averageDiscrepancy = perP.reduce((sum, entry) => sum + entry.avgDiscrepancy, 0) / perP.length;
        const averageConsensusRound = perP.reduce(
          (sum, entry) => sum + (entry.avgConsensusRound || sequenceDefinition.sequence.length),
          0
        ) / perP.length;

        results.push({
          ...sequenceDefinition,
          perP,
          averageAgreement,
          averageDiscrepancy,
          averageConsensusRound
        });
      }
    }

    setSequenceResults(results);
    const finalProgress = totalSteps > 0 ? Math.round((completed / totalSteps) * 100) : 100;
    setProgress(Math.min(100, finalProgress));
    setIsRunning(false);
    setStatus(
      cancelRef.current
        ? `Cancelled after ${completed}/${totalSteps} steps`
        : `Done. Tested ${results.length} sequences. The table reports E[D], and Pr[agreement] remains available per p in the run data.`
    );
  };

  const runOptimalExplorer = async () => {
    const generatedSequences = generateSequences(EXPLORER_RULES, explorerSequenceLength, 500);
    if (generatedSequences.length === 0) {
      setStatus('No explorer sequences were generated.');
      return;
    }

    const sequenceDefinitions = generatedSequences.map((sequence, index) => {
      const label = buildSequenceLabel(sequence);
      const sequenceId = sequence.map((rule) => rule.id).join('->') || `explorer-sequence-${index}`;
      return {
        id: `explorer-${sequenceId}`,
        baseId: sequenceId,
        sequence,
        label,
        notation: label,
        shortLabel: label,
        description: 'Generated by the Optimal Sequence Explorer.',
        deliveryMode: EXPLORER_DELIVERY_MODE,
        colorCategory: getExplorerSequenceCategory(sequence)
      };
    });

    const majorityValue = computeMajorityValue(explorerInitialValues);
    const totalSteps = sequenceDefinitions.length * explorerPValues.length;
    const results = [];
    let completed = 0;

    cancelRef.current = false;
    setIsRunning(true);
    setProgress(0);
    setExplorerResults([]);
    setStatus(`Evaluating sequence 1 of ${sequenceDefinitions.length}...`);

    for (let sequenceIndex = 0; sequenceIndex < sequenceDefinitions.length; sequenceIndex += 1) {
      if (cancelRef.current) break;
      const sequenceDefinition = sequenceDefinitions[sequenceIndex];
      const perP = [];
      setStatus(`Evaluating sequence ${sequenceIndex + 1} of ${sequenceDefinitions.length}...`);

      for (const p of explorerPValues) {
        if (cancelRef.current) break;
        const metrics = runSinglePolicyAtP(
          sequenceDefinition.sequence,
          explorerInitialValues,
          p,
          EXPLORER_DELIVERY_MODE,
          'majority',
          majorityValue,
          explorerRepetitions
        );

        perP.push({
          p,
          ...metrics,
          key: `${p}_${sequenceDefinition.baseId}`
        });

        completed += 1;
        if (totalSteps > 0 && (completed % 5 === 0 || completed === totalSteps)) {
          setProgress(Math.min(100, Math.round((completed / totalSteps) * 100)));
          await maybeYield(completed);
        }
      }

      if (perP.length > 0) {
        const averageAgreement = perP.reduce((sum, entry) => sum + entry.successRate, 0) / perP.length;
        const averageDiscrepancy = perP.reduce((sum, entry) => sum + entry.avgDiscrepancy, 0) / perP.length;
        const averageConsensusRound = perP.reduce(
          (sum, entry) => sum + (entry.avgConsensusRound || sequenceDefinition.sequence.length),
          0
        ) / perP.length;

        results.push({
          ...sequenceDefinition,
          perP,
          averageAgreement,
          averageDiscrepancy,
          averageConsensusRound
        });
      }
    }

    setExplorerResults(results);
    const finalProgress = totalSteps > 0 ? Math.round((completed / totalSteps) * 100) : 100;
    setProgress(Math.min(100, finalProgress));
    setIsRunning(false);
    setStatus(
      cancelRef.current
        ? `Cancelled after ${completed}/${totalSteps} evaluations`
        : `Done. Evaluated ${results.length} sequences across ${explorerPValues.length} p values.`
    );
  };

  const exportExplorerCsv = () => {
    if (explorerResults.length === 0) return;
    const rows = ['sequence,p,experimental_ED'];
    explorerResults.forEach((result) => {
      result.perP.forEach((entry) => {
        rows.push(`${escapeCsvValue(result.label)},${entry.p},${entry.avgDiscrepancy}`);
      });
    });

    const link = document.createElement('a');
    link.href = `data:text/csv;charset=utf-8,${encodeURIComponent(rows.join('\n'))}`;
    link.download = `optimal-sequence-explorer-r${explorerSequenceLength}.csv`;
    link.click();
  };

  const showMeetingPointControls = selectedRuleIds.includes('AMP') || selectedRuleIds.includes('RECURSIVE_AMP');
  const sidebarSequenceLength = explorerMode === 'optimal' ? explorerSequenceLength : sequenceLength;
  const sidebarRepetitions = explorerMode === 'optimal' ? explorerRepetitions : repetitions;
  const estimatedRunCount = explorerMode === 'optimal'
    ? Math.pow(EXPLORER_RULES.length, explorerSequenceLength) * explorerPValues.length
    : builderMode === 'predefined'
      ? selectedPredefinedSequences.length * deliveryModesToUse.length
      : rawSequenceCount;
  const customDeliveryLabel = deliveryModesToUse.length === 1
    ? (DELIVERY_MODE_OPTIONS.find((option) => option.id === deliveryModesToUse[0])?.title || deliveryModesToUse[0])
    : `${deliveryModesToUse.length} delivery models`;

  return (
    <div className="flex h-full min-h-[760px] flex-row overflow-hidden rounded-2xl bg-slate-50 shadow-xl ring-1 ring-slate-200">
      <aside className="w-64 lg:w-72 flex-shrink-0 space-y-3">
        <div className="space-y-3">
          <div className="flex bg-white rounded-lg shadow-sm ring-1 ring-gray-200 p-1 gap-1">
            {[
              { id: 'custom', label: '\uD83D\uDD0D Custom Search' },
              { id: 'optimal', label: '\uD83C\uDFC6 Optimal Explorer' }
            ].map((modeOption) => (
              <button
                key={modeOption.id}
                type="button"
                onClick={() => setExplorerMode(modeOption.id)}
                disabled={isRunning}
                className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition ${
                  explorerMode === modeOption.id
                    ? 'bg-green-100 text-green-800 shadow-sm ring-1 ring-green-200'
                    : 'text-gray-500 hover:text-gray-700'
                } ${isRunning ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                {modeOption.label}
              </button>
            ))}
          </div>

          {explorerMode === 'optimal' ? (
            <div className="card glass-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900">Explorer Setup</h3>
              </div>

              <div>
                <label className="block text-xs mb-1 text-gray-600">Sequence length</label>
                <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                  {EXPLORER_SEQUENCE_LENGTH_OPTIONS.map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setExplorerSequenceLength(option)}
                      disabled={isRunning}
                      className={`flex-1 px-3 py-1 text-xs transition ${
                        explorerSequenceLength === option
                          ? 'border border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold first:rounded-l-lg last:rounded-r-lg'
                          : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 first:rounded-l-lg last:rounded-r-lg'
                      } ${isRunning ? 'cursor-not-allowed opacity-70' : ''}`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1 text-gray-600">Repetitions per p</label>
                <NumericTextInput
                  min="1"
                  max="5000"
                  integer
                  value={explorerRepetitions}
                  onValueChange={(nextValue) => setExplorerRepetitions(Math.max(1, nextValue || 1))}
                  className="w-full p-1.5 text-sm border border-gray-300 rounded-md bg-white"
                  disabled={isRunning}
                />
              </div>

              <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1.5 border border-slate-200 mt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-gray-700">Initial Values</span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setExplorerInitialValues((prev) => [...prev, 0])}
                      disabled={isRunning}
                      className="px-1.5 py-0.5 text-xs rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 disabled:opacity-40"
                    >+</button>
                    <button
                      type="button"
                      onClick={() => setExplorerInitialValues((prev) =>
                        prev.length > 2 ? prev.slice(0, -1) : prev)}
                      disabled={isRunning || explorerInitialValues.length <= 2}
                      className="px-1.5 py-0.5 text-xs rounded bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 disabled:opacity-40"
                    >-</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {explorerInitialValues.map((val, idx) => {
                    const name = ['Alice', 'Bob', 'Charlie'][idx] ?? `P${idx + 1}`;
                    const color = getProcessColor(idx);
                    return (
                      <div key={idx}>
                        <label className="text-[11px] font-medium block mb-0.5" style={{ color }}>{name}</label>
                        <NumericTextInput
                          value={val}
                          onValueChange={(v) => {
                            const next = [...explorerInitialValues];
                            next[idx] = Number.isFinite(v) ? v : 0;
                            setExplorerInitialValues(next);
                          }}
                          className="w-full p-1 text-xs border rounded"
                          style={{ borderColor: color }}
                          disabled={isRunning}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs mt-2">
                  <span className="text-slate-500">Delivery</span>
                  <span className="font-medium text-purple-700">Broadcast</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">n</span>
                  <span className="font-medium text-slate-800">
                    {explorerInitialValues.length} processes
                  </span>
                </div>
              </div>

              {explorerSequenceLength >= 3 && (
                <div className="text-[11px] text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-2 py-1.5 mt-1">
                  {`\u26A0 r=${explorerSequenceLength} generates ${3 ** explorerSequenceLength} sequences. May take ~${explorerSequenceLength === 3 ? '60s' : '3min'}.`}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="card glass-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Setup</h3>
                  <span className="pill bg-slate-50 border border-slate-200 text-slate-700">{`n=${processCount}`}</span>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-semibold">Initial Values ({processCount} processes)</h3>
                    <div className="flex space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          if (processCount <= 2 || isRunning) return;
                          setInitialValues(initialValues.slice(0, -1));
                        }}
                        className={`p-1 rounded-md ${processCount <= 2 || isRunning
                          ? 'opacity-30 cursor-not-allowed bg-gray-100 text-gray-400'
                          : 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200'}`}
                        disabled={processCount <= 2 || isRunning}
                        aria-label="Remove process"
                      >
                        {'\u2212'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (isRunning) return;
                          setInitialValues([...initialValues, 0]);
                        }}
                        className={`p-1 rounded-md ${isRunning
                          ? 'opacity-30 cursor-not-allowed bg-gray-100 text-gray-400'
                          : 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-200'}`}
                        disabled={isRunning}
                        aria-label="Add process"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {initialValues.map((value, index) => {
                      const processName = ['Alice', 'Bob', 'Charlie'][index] ?? `P${index + 1}`;
                      const color = getProcessColor(index);
                      return (
                        <div key={index}>
                          <div className="flex justify-between items-center mb-1">
                            <label className="text-xs font-medium" style={{ color }}>
                              {processName}
                            </label>
                          </div>
                          <NumericTextInput
                            value={value}
                            onValueChange={(nextValue) => {
                              if (isRunning) return;
                              const next = [...initialValues];
                              next[index] = Number.isFinite(nextValue) ? nextValue : 0;
                              setInitialValues(next);
                            }}
                            className="w-full p-1 text-sm border rounded-md"
                            style={{ borderColor: color }}
                            disabled={isRunning}
                            placeholder="Value"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs mb-1 text-gray-600">Repetitions per p</label>
                  <NumericTextInput
                    min="1"
                    max="5000"
                    integer
                    value={repetitions}
                    onValueChange={(nextValue) => setRepetitions(Math.max(1, nextValue || 1))}
                    className="w-full p-1.5 text-sm border border-gray-300 rounded-md bg-white"
                    disabled={isRunning}
                  />
                </div>

                <div>
                  <label className="block text-xs mb-1 text-gray-600">Sequence length</label>
                  <div className="flex border border-gray-200 rounded-lg overflow-hidden">
                    {EXPLORER_SEQUENCE_LENGTH_OPTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setSequenceLength(option)}
                        disabled={isRunning}
                        className={`flex-1 px-3 py-1 text-xs transition ${
                          sequenceLength === option
                            ? 'border border-emerald-300 bg-emerald-50 text-emerald-800 font-semibold first:rounded-l-lg last:rounded-r-lg'
                            : 'border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 first:rounded-l-lg last:rounded-r-lg'
                        } ${isRunning ? 'cursor-not-allowed opacity-70' : ''}`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-gray-500">{`~${estimatedRunCount.toLocaleString()} sequences to evaluate`}</p>
              </div>

              <div className="card glass-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Algorithm Building Blocks</h3>
                  <span className="pill bg-slate-50 border border-slate-200 text-slate-700">
                    {builderMode === 'predefined' ? 'Named sequences' : 'Custom builder'}
                  </span>
                </div>

                <div className="flex bg-white rounded-lg shadow-sm ring-1 ring-gray-200 p-1 gap-1">
                  {[
                    { id: 'predefined', label: 'Named sequences' },
                    { id: 'custom', label: 'Custom builder' }
                  ].map((modeOption) => (
                    <button
                      key={modeOption.id}
                      type="button"
                      onClick={() => {
                        setBuilderMode(modeOption.id);
                        if (modeOption.id === 'custom') {
                          setAdvancedOpen(true);
                        }
                      }}
                      disabled={isRunning}
                      className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition ${
                        builderMode === modeOption.id
                          ? 'bg-green-100 text-green-800 shadow-sm ring-1 ring-green-200'
                          : 'text-gray-500 hover:text-gray-700'
                      } ${isRunning ? 'cursor-not-allowed opacity-70' : ''}`}
                    >
                      {modeOption.label}
                    </button>
                  ))}
                </div>

                {builderMode === 'predefined' ? (
                  <div className="space-y-2">
                    {PREDEFINED_SEQUENCE_OPTIONS.map((option) => (
                      <label
                        key={option.id}
                        className={`flex items-start py-2 px-2 rounded hover:bg-gray-50 cursor-pointer ${
                          isRunning ? 'opacity-70 cursor-not-allowed' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          className="mr-2 accent-emerald-600"
                          checked={selectedPredefinedIds.includes(option.id)}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSelectedPredefinedIds((prev) => (
                              checked
                                ? Array.from(new Set([...prev, option.id]))
                                : prev.filter((id) => id !== option.id)
                            ));
                          }}
                          disabled={isRunning}
                        />
                        <div className="min-w-0">
                          <div className="pill bg-slate-50 border border-slate-200 text-slate-700">{option.name}</div>
                          <div className="mt-1 text-xs text-gray-600">{option.notation}</div>
                          <div className="text-[11px] text-gray-400">{option.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                      {BASE_RULES.map((rule) => {
                        const disabled = (rule.requireThree && processCount !== 3) || (rule.requireBinary && !binary);
                        const algorithmClass = rule.algorithm === 'AMP' || rule.algorithm === 'RECURSIVE AMP'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : rule.algorithm === 'FV'
                            ? 'bg-blue-50 text-blue-800 border border-blue-200'
                            : rule.algorithm === 'COURTEOUS'
                              ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                              : rule.algorithm === 'PREF1'
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : rule.algorithm === 'PREF0'
                                  ? 'bg-lime-50 text-lime-800 border border-lime-200'
                                  : rule.algorithm === 'MIN'
                                    ? 'bg-yellow-50 text-yellow-800 border border-yellow-200'
                                    : rule.algorithm === 'LEADER'
                                      ? 'bg-orange-50 text-orange-800 border border-orange-200'
                                      : ['SELFISH', 'CYCLIC', 'BIASED0'].includes(rule.algorithm)
                                        ? 'bg-rose-50 text-rose-800 border border-rose-200'
                                        : 'bg-gray-100 text-gray-700 border border-gray-200';
                        return (
                          <label
                            key={rule.id}
                            className={`flex items-center py-1 px-1 rounded hover:bg-gray-50 cursor-pointer ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                          >
                            <input
                              type="checkbox"
                              className="mr-2 accent-emerald-600"
                              checked={selectedRuleIds.includes(rule.id)}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setSelectedRuleIds((prev) => (
                                  checked
                                    ? Array.from(new Set([...prev, rule.id]))
                                    : prev.filter((id) => id !== rule.id)
                                ));
                              }}
                              disabled={disabled || isRunning}
                            />
                            <span className={`pill ${algorithmClass}`}>{rule.label}</span>
                          </label>
                        );
                      })}
                    </div>

                    {showMeetingPointControls && (
                      <div>
                        <div className="text-xs text-gray-500 mt-2 mb-1">Meeting points (AMP)</div>
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
                            className="flex-1 p-1.5 text-sm border border-gray-300 rounded-md bg-white"
                            disabled={isRunning}
                          />
                          <button
                            type="button"
                            className="px-2 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700"
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
                            <span key={mp} className="px-2 py-0.5 text-xs bg-gray-100 border border-gray-200 rounded-full flex items-center gap-1">
                              a={mp}
                              <button
                                type="button"
                                className="text-gray-500 hover:text-rose-500"
                                onClick={() => {
                                  setMeetingPoints((prev) => {
                                    const next = prev.filter((value) => value !== mp);
                                    return next.length ? next : [mp];
                                  });
                                }}
                                disabled={isRunning}
                              >
                                {'\u00D7'}
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="card glass-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-900">Delivery Model</h3>
                  <span className="pill bg-slate-50 border border-slate-200 text-slate-700">
                    {deliveryModesToUse.length} selected
                  </span>
                </div>

                <div className="space-y-1">
                  {DELIVERY_MODE_OPTIONS.map((modeOption) => (
                    <label
                      key={modeOption.id}
                      className="flex items-center text-xs px-2 py-1.5 rounded hover:bg-gray-50 cursor-pointer transition"
                    >
                      <input
                        type="checkbox"
                        className="mr-2 accent-emerald-600"
                        checked={deliveryModesToUse.includes(modeOption.id)}
                        onChange={(e) => toggleDeliveryMode(modeOption.id, e.target.checked)}
                        disabled={isRunning}
                      />
                      <span className={`pill ${modeBadgeClass(modeOption.id)}`}>
                        {modeOption.id === 'process-dependent' ? 'Broadcast' : modeOption.title}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="card glass-card p-4 space-y-2">
                <button
                  type="button"
                  className="flex items-center justify-between cursor-pointer w-full text-left"
                  onClick={() => setAdvancedOpen((prev) => !prev)}
                  disabled={isRunning}
                >
                  <span className="text-sm font-semibold text-gray-900">Advanced</span>
                  <span className="text-xs text-gray-400">{advancedOpen ? '\u25B2' : '\u25BC'}</span>
                </button>

                {advancedOpen && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <label className="block text-xs mb-1 text-gray-600">Probability range</label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] mb-1 text-gray-500">min</label>
                          <NumericTextInput
                            min="0"
                            max="1"
                            value={pRange.min}
                            onValueChange={(nextValue) => setPRange({ ...pRange, min: nextValue || 0 })}
                            className="w-full p-1.5 text-sm border border-gray-300 rounded-md bg-white"
                            disabled={isRunning}
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] mb-1 text-gray-500">max</label>
                          <NumericTextInput
                            min="0"
                            max="1"
                            value={pRange.max}
                            onValueChange={(nextValue) => setPRange({ ...pRange, max: Number.isFinite(nextValue) ? nextValue : 1 })}
                            className="w-full p-1.5 text-sm border border-gray-300 rounded-md bg-white"
                            disabled={isRunning}
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs mb-1 text-gray-600">steps</label>
                      <NumericTextInput
                        min="1"
                        max="500"
                        integer
                        value={pRange.steps}
                        onValueChange={(nextValue) => setPRange({ ...pRange, steps: Math.max(1, nextValue || 1) })}
                        className="w-full p-1.5 text-sm border border-gray-300 rounded-md bg-white"
                        disabled={isRunning}
                      />
                    </div>

                    <div>
                      <label className="block text-xs mb-1 text-gray-600">Exact sequence length</label>
                      <NumericTextInput
                        min="1"
                        integer
                        value={sequenceLength}
                        onValueChange={(nextValue) => setSequenceLength(Math.max(1, Number.isFinite(nextValue) ? nextValue : 1))}
                        className="w-full p-1.5 text-sm border border-gray-300 rounded-md bg-white"
                        disabled={isRunning}
                      />
                    </div>

                    <div>
                      <label className="block text-xs mb-1 text-gray-600">Sequence cap</label>
                      <NumericTextInput
                        min="50"
                        max="800"
                        integer
                        value={policyCap}
                        onValueChange={(nextValue) => setPolicyCap(Math.max(50, Math.min(800, nextValue || 50)))}
                        className="w-full p-1.5 text-sm border border-gray-300 rounded-md bg-white"
                        disabled={isRunning}
                      />
                      <p className="text-[11px] text-gray-400 mt-1">Max sequences to generate</p>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}

          <div className="sticky bottom-0 pt-2 pb-1 bg-transparent">
            <button
              type="button"
              onClick={() => {
                if (isRunning) {
                  cancelRef.current = true;
                  setStatus('Cancelling...');
                } else if (explorerMode === 'optimal') {
                  runOptimalExplorer();
                } else {
                  runSequenceComparison();
                }
              }}
              className={isRunning
                ? 'w-full p-2.5 text-sm font-semibold bg-gradient-to-r from-rose-500 to-red-600 text-white rounded-lg shadow-md'
                : 'w-full p-2.5 text-sm font-semibold btn-primary rounded-lg'}
            >
              {isRunning ? '\u25A0  Cancel' : '\u25B6  Run Search'}
            </button>

            {isRunning && (
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            <p className="text-xs text-gray-500 mt-1 truncate">{status}</p>
            <p className="text-[11px] text-gray-400 text-center mt-1">{`~${estimatedRunCount.toLocaleString()} sequences`}</p>
          </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-50 p-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">Multi-Round Sequence Comparison</h3>
              <p className="text-sm text-slate-600">
                {explorerMode === 'optimal'
                  ? 'Empirical search over all explorer sequences.'
                  : 'Compare named sequences or build them from algorithm blocks.'}
              </p>
            </div>
            <button
              type="button"
              onClick={exportExplorerCsv}
              disabled={explorerMode !== 'optimal' || explorerResults.length === 0}
              className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                explorerMode !== 'optimal' || explorerResults.length === 0
                  ? 'cursor-not-allowed border-slate-200 bg-white text-slate-300'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              Export CSV
            </button>
          </div>

          {explorerMode === 'custom' ? (
            <>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
                <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-slate-800">Sequence error curves</h4>
                    <p className="mb-2 text-xs text-slate-500">
                      {`E[D] vs p  \u00B7  n=${processCount}, ${customDeliveryLabel.toLowerCase()}, input=[${initialValues.join(',')}]`}
                    </p>
                  </div>
                  <div className="text-xs text-slate-500">
                    Showing {chartSequences.length} of {sequenceResults.length} sequence curves
                  </div>
                </div>

                {chartSequences.length === 0 ? (
                  <div className="flex h-[420px] items-center justify-center">
                    <div className="max-w-md text-center text-slate-400">
                      <div className="mb-4 text-4xl">{'\uD83E\uDDED'}</div>
                      <div className="text-lg font-medium text-slate-500">Configure and run a search</div>
                      <p className="mt-2 text-sm">to compare multi-round sequences</p>
                      <button
                        type="button"
                        onClick={runSequenceComparison}
                        className="mt-6 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                      >
                        {'\u25B6 Run Search'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="h-[540px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 16, right: 24, left: 72, bottom: 48 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="p" tickFormatter={(v) => v.toFixed(2)} stroke="#64748b">
                          <Label value="p" position="insideBottom" dy={14} />
                        </XAxis>
                        <YAxis domain={[0, 1]} tickFormatter={(v) => v.toFixed(1)} stroke="#64748b">
                          <Label
                            value="E[D]"
                            angle={-90}
                            position="insideLeft"
                            dx={-40}
                            style={{ textAnchor: 'middle' }}
                          />
                        </YAxis>
                        <Tooltip
                          wrapperStyle={{ fontSize: '12px' }}
                          formatter={(value, name, props) => {
                            const result = sequenceResults.find((sequenceResult) => sequenceResult.id === name);
                            if (result) {
                              const point = result.perP.find((entry) => Math.abs(entry.p - props.payload.p) < 1e-6);
                              if (point) {
                                return [
                                  `E[D]=${value?.toFixed(3)} | Pr[agreement]=${point.successRate.toFixed(3)}`,
                                  `${result.label} [${result.deliveryMode}]`
                                ];
                              }
                            }
                            return [value?.toFixed(3), name];
                          }}
                          labelFormatter={(v) => `p=${Number(v).toFixed(3)}`}
                        />
                        <Legend />
                        {showTwoThirdsReference && (
                          <ReferenceLine
                            x={2 / 3}
                            stroke="#dc2626"
                            strokeDasharray="4 4"
                            label={{
                              value: courteousPref1Crossover?.value != null ? 'p = 2/3 (exact, n=3)' : 'p = 2/3 (crossover n=3)',
                              position: 'top',
                              fill: '#dc2626',
                              fontSize: 11
                            }}
                          />
                        )}
                        {courteousPref1Crossover?.value != null && (
                          <ReferenceLine
                            x={courteousPref1Crossover.value}
                            stroke="#2563eb"
                            strokeDasharray="6 3"
                            label={{
                              value: `Crossover \u2248 ${courteousPref1Crossover.value.toFixed(3)}`,
                              position: 'top',
                              fill: '#2563eb',
                              fontSize: 11
                            }}
                          />
                        )}
                        {chartSequences.map((result, idx) => (
                          <Line
                            key={result.id}
                            type="monotone"
                            dataKey={result.id}
                            name={result.shortLabel || `${result.label} [${result.deliveryMode}]`}
                            stroke={getProcessColor(idx)}
                            dot={false}
                            strokeWidth={highlightedPolicyId === null ? 1.5 : result.id === highlightedPolicyId ? 3 : 1}
                            strokeOpacity={highlightedPolicyId === null ? 0.8 : result.id === highlightedPolicyId ? 1 : 0.2}
                            isAnimationActive={false}
                          />
                        ))}
                        {sweepTheorySeries.map((series) => (
                          <Line
                            key={series.dataKey}
                            type="monotone"
                            dataKey={series.dataKey}
                            name={series.name}
                            stroke={series.stroke}
                            strokeDasharray={series.dash}
                            strokeWidth={2}
                            dot={false}
                            isAnimationActive={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {processCount > 3 && courteousPref1Crossover?.value != null && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                  For n=3 the exact crossover is p=2/3. For n&gt;3 no closed form exists.
                </div>
              )}

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <h4 className="text-lg font-semibold text-slate-800">Sequence summary</h4>
                  <span className="text-sm text-slate-500">Showing {resultsTableRows.length} sequences</span>
                </div>
                <div className="px-4 pt-3 text-[11px] text-gray-400">
                  Click a row to highlight its curve in the chart
                </div>
                {resultsTableRows.length === 0 ? (
                  <div className="px-6 py-10 text-center text-sm text-slate-400">No results yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-3 text-left">Chart</th>
                          <th className="px-3 py-3 text-left">Sequence</th>
                          <th className="px-3 py-3 text-left">Delivery</th>
                          <th className="px-3 py-3 text-right">E[D] @ 0.3</th>
                          <th className="px-3 py-3 text-right">E[D] @ 0.5</th>
                          <th className="px-3 py-3 text-right">E[D] @ 0.7</th>
                          <th className="px-3 py-3 text-right">Crossover vs SWEEP theory</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resultsTableRows.map((result, idx) => (
                          <tr
                            key={result.id}
                            onClick={() => setHighlightedPolicyId((prev) => (prev === result.id ? null : result.id))}
                            className={`cursor-pointer transition ${
                              highlightedPolicyId === result.id
                                ? 'bg-blue-50 ring-1 ring-inset ring-blue-300'
                                : idx % 2 === 0 ? 'bg-white hover:bg-gray-50' : 'bg-slate-50 hover:bg-gray-50'
                            }`}
                          >
                            <td className="px-3 py-3 align-top">
                              <input
                                type="checkbox"
                                checked={visibleSet.has(result.id)}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  const checked = e.target.checked;
                                  setVisibleSequenceIds((prev) => {
                                    if (checked) return Array.from(new Set([...prev, result.id]));
                                    return prev.filter((id) => id !== result.id);
                                  });
                                }}
                              />
                            </td>
                            <td className="px-3 py-3 align-top">
                              <div className="font-semibold text-slate-800">{result.label}</div>
                              <div className="truncate text-xs text-slate-500" title={result.notation || result.label}>
                                {result.notation || result.label}
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
                                {result.description} Sequence length: {result.sequence.length}
                              </div>
                            </td>
                            <td className="px-3 py-3 align-top">
                              <span className={`inline-flex rounded-full px-2 py-1 text-[11px] ${modeBadgeClass(result.deliveryMode)}`}>
                                {result.deliveryMode}
                              </span>
                            </td>
                            {TARGET_REGIME_POINTS.map((point) => (
                              <td key={`${result.id}-${point}`} className="px-3 py-3 text-right font-mono text-xs text-slate-700">
                                {typeof result.regimeSamples[point] === 'number' ? result.regimeSamples[point].toFixed(3) : '\u2014'}
                              </td>
                            ))}
                            <td className="px-3 py-3 text-right text-xs">
                              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-1 text-slate-600">
                                {result.sweepTheoryLabel}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-4">
                <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h4 className="text-lg font-semibold text-slate-800">Explorer curves</h4>
                    <p className="mb-2 text-xs text-slate-500">
                      {`E[D] vs p  \u00B7  n=${explorerN}, broadcast, input=[${explorerInitialValues.join(',')}]`}
                    </p>
                  </div>
                  <div className="text-xs text-slate-500">
                    Showing {explorerResults.length} sequence curves
                  </div>
                </div>

                {explorerResults.length > 0 && (
                  <div className="mb-4">
                    {explorerSweepBeatCount === 0 ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-50 border border-green-200 text-green-800 text-xs font-medium">
                        {'\u2713'} No sequence beats SWEEP theory across all p values
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
                        {'\u26A1'} A sequence beats SWEEP theory at {explorerSweepBeatCount} p-values
                      </div>
                    )}
                  </div>
                )}

                {explorerResults.length === 0 ? (
                  <div className="flex h-[400px] items-center justify-center">
                    <div className="max-w-md text-center text-slate-400">
                      <div className="mb-4 text-4xl">{'\uD83E\uDDED'}</div>
                      <div className="text-lg font-medium text-slate-500">Configure and run a search</div>
                      <p className="mt-2 text-sm">to compare multi-round sequences</p>
                      <button
                        type="button"
                        onClick={runOptimalExplorer}
                        className="mt-6 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
                      >
                        {'\u25B6 Run Search'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
                    <div className="h-[400px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart
                          data={explorerChartData}
                          margin={{ top: 16, right: 24, left: 72, bottom: 64 }}
                          onMouseMove={(e) => {
                            if (e && e.activeLabel != null) setInspectorP(Number(e.activeLabel));
                          }}
                          onMouseLeave={() => setInspectorP(null)}
                        >
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="p" tickFormatter={(v) => Number(v).toFixed(2)} stroke="#64748b">
                            <Label value="p" position="insideBottom" dy={14} />
                          </XAxis>
                          <YAxis domain={[0, 1]} tickFormatter={(v) => Number(v).toFixed(1)} stroke="#64748b">
                            <Label
                              value="E[D] = Pr[error]"
                              angle={-90}
                              position="insideLeft"
                              dx={-44}
                              style={{ textAnchor: 'middle' }}
                            />
                          </YAxis>
                          <Tooltip
                            wrapperStyle={{ fontSize: '12px' }}
                            formatter={(value, _name, item) => {
                              const result = explorerResults.find((entry) => entry.id === item.dataKey);
                              if (result) {
                                const point = result.perP.find((entry) => Math.abs(entry.p - item.payload.p) < 1e-6);
                                if (point) {
                                  return [
                                    `E[D]=${Number(value).toFixed(3)} | Pr[agreement]=${point.successRate.toFixed(3)}`,
                                    result.label
                                  ];
                                }
                              }

                              if (item.dataKey === 'empiricalOptimal') {
                                return [Number(value).toFixed(3), 'Empirical optimal (min over all sequences)'];
                              }
                              if (item.dataKey === 'sweepTheory') {
                                return [Number(value).toFixed(3), `SWEEP theory: q^${explorerN}`];
                              }
                              if (item.dataKey === 'oneRoundOptimalTheory') {
                                return [Number(value).toFixed(3), '1-round optimal (theory)'];
                              }
                              return [Number(value).toFixed(3), item.name];
                            }}
                            labelFormatter={(value) => `p=${Number(value).toFixed(3)}`}
                          />
                          <Legend verticalAlign="bottom" wrapperStyle={{ paddingTop: 12, fontSize: '11px' }} />
                          <ReferenceLine
                            x={2 / 3}
                            stroke="#6b7280"
                            strokeDasharray="3 3"
                            label={{ value: 'p=2/3', position: 'top', fill: '#4b5563', fontSize: 11 }}
                          />
                          {inspectorP != null && (
                            <ReferenceLine x={inspectorP} stroke="#0f172a" strokeDasharray="3 3" />
                          )}
                          {explorerResults.map((result) => (
                            <Line
                              key={result.id}
                              type="monotone"
                              dataKey={result.id}
                              name={result.label}
                              stroke={explorerColorByLabel[result.label]}
                              dot={false}
                              strokeWidth={1}
                              strokeOpacity={0.5}
                              isAnimationActive={false}
                            />
                          ))}
                          <Line
                            type="monotone"
                            dataKey="empiricalOptimal"
                            name="Empirical optimal (min over all sequences)"
                            stroke="#111111"
                            dot={false}
                            strokeWidth={3}
                            isAnimationActive={false}
                          />
                          {explorerSequenceLength >= 2 && (
                            <Line
                              type="monotone"
                              dataKey="sweepTheory"
                              name={`SWEEP theory: q^${explorerN}`}
                              stroke="#dc2626"
                              strokeDasharray="6 3"
                              dot={false}
                              strokeWidth={2}
                              isAnimationActive={false}
                            />
                          )}
                          <Line
                            type="monotone"
                            dataKey="oneRoundOptimalTheory"
                            name="1-round optimal (theory)"
                            stroke="#6b7280"
                            strokeDasharray="4 4"
                            dot={false}
                            strokeWidth={2}
                            isAnimationActive={false}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    {inspectorP != null && (
                      <div className="bg-white rounded-xl shadow-lg border border-slate-200 p-3 text-xs min-w-[200px] self-start">
                        <div className="text-sm font-semibold text-slate-800 mb-2">
                          p = {inspectorP.toFixed(3)}
                        </div>
                        <div className="space-y-1">
                          {inspectorRows.map((row, index) => {
                            const sweepTheory = Math.pow(1 - inspectorP, explorerN);
                            const gap = row.avgDiscrepancy - sweepTheory;
                            return (
                              <div
                                key={row.id}
                                className={`grid grid-cols-[20px_minmax(0,1fr)_56px_60px] items-center gap-2 rounded px-2 py-1 ${
                                  row.label === EXPLORER_SWEEP_LABEL ? 'bg-yellow-50' : ''
                                }`}
                              >
                                <span className="text-slate-400">{index + 1}</span>
                                <span className="truncate font-mono text-slate-700">{row.label}</span>
                                <span className="text-right font-semibold text-slate-900">{row.avgDiscrepancy.toFixed(4)}</span>
                                <span className={`text-right ${
                                  gap < -0.0005
                                    ? 'text-green-600'
                                    : gap > 0.0005
                                      ? 'text-red-600'
                                      : 'text-gray-400'
                                }`}>
                                  {gap < -0.0005
                                    ? `\u25BC ${Math.abs(gap).toFixed(4)}`
                                    : gap > 0.0005
                                      ? `\u25B2 ${gap.toFixed(4)}`
                                      : '\u2248 SWEEP'}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                        <div className="text-slate-400 text-[10px] mt-1">
                          {`SWEEP theory q^${explorerN} = ${Math.pow(1 - inspectorP, explorerN).toFixed(4)}`}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
                <div className="mb-4">
                  <h4 className="text-lg font-semibold text-slate-800">Optimal sequence by p value</h4>
                  <p className="text-sm text-slate-600">Each segment is colored by the sequence with the lowest simulated E[D] at that p.</p>
                </div>

                {explorerOptimalBand.length === 0 ? (
                  <div className="px-6 py-10 text-center text-sm text-slate-400">Run the explorer to see the winning sequence band.</div>
                ) : (
                  <>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <svg
                        width="100%"
                        height="40"
                        viewBox={`0 0 ${explorerOptimalBand.length} 40`}
                        preserveAspectRatio="none"
                        role="img"
                        aria-label="Optimal sequence band by p value"
                      >
                        {explorerOptimalBand.map((segment) => (
                          <rect
                            key={`${segment.index}-${segment.label}`}
                            x={segment.index}
                            y="0"
                            width="1"
                            height="40"
                            fill={segment.color}
                          />
                        ))}
                      </svg>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {explorerBandLegend.map((item) => (
                        <span key={item.label} className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                          {item.label}
                        </span>
                      ))}
                    </div>

                    <div className="relative mt-4 h-9 text-[11px] text-slate-500">
                      {EXPLORER_REFERENCE_POINTS.map((point, index) => {
                        const percentage = `${point * 100}%`;
                        const label = index === 0 ? '0' : index === 1 ? '1/3' : index === 2 ? '1/2' : index === 3 ? '2/3' : '1';
                        const transform = index === 0 ? 'translateX(0)' : index === EXPLORER_REFERENCE_POINTS.length - 1 ? 'translateX(-100%)' : 'translateX(-50%)';
                        return (
                          <div
                            key={`${point}`}
                            className="absolute top-0"
                            style={{ left: percentage, transform }}
                          >
                            <div className="mx-auto h-2 w-px bg-slate-400" />
                            <div className="mt-1 whitespace-nowrap">{label}</div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <h4 className="text-lg font-semibold text-slate-800">Explorer results</h4>
                  <span className="text-sm text-slate-500">
                    Showing {Math.min(20, explorerResultsTableRows.length)} of {explorerResultsTableRows.length} sequences
                  </span>
                </div>

                {explorerResultsTableRows.length === 0 ? (
                  <div className="px-6 py-10 text-center text-sm text-slate-400">No results yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-3 py-3 text-left">Rank</th>
                          <th className="px-3 py-3 text-left">Sequence</th>
                          <th className="px-3 py-3 text-right">E[D] at p=0.3</th>
                          <th className="px-3 py-3 text-right">E[D] at p=0.5</th>
                          <th className="px-3 py-3 text-right">E[D] at p=0.7</th>
                          <th className="px-3 py-3 text-right">Avg E[D]</th>
                        </tr>
                      </thead>
                      <tbody>
                        {explorerResultsTableRows.slice(0, 20).map((result, index) => {
                          const isSweepReference = result.label === EXPLORER_SWEEP_LABEL;
                          return (
                            <tr
                              key={result.id}
                              className={`${
                                isSweepReference
                                  ? 'bg-yellow-50'
                                  : index % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                              } hover:bg-slate-100`}
                            >
                              <td className={`px-3 py-3 font-semibold text-slate-700 ${isSweepReference ? 'border-l-4 border-yellow-500' : ''}`}>{index + 1}</td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: explorerColorByLabel[result.label] }} />
                                  <span className="font-semibold text-slate-900">{result.label}</span>
                                </div>
                                {isSweepReference && (
                                  <div className="mt-1 text-[11px] font-semibold text-yellow-700">{'\u2605 SWEEP (paper reference)'}</div>
                                )}
                              </td>
                              {TARGET_REGIME_POINTS.map((point) => (
                                <td key={`${result.id}-${point}`} className="px-3 py-3 text-right font-mono text-xs text-slate-700">
                                  {typeof result.regimeSamples[point] === 'number' ? result.regimeSamples[point].toFixed(3) : '\u2014'}
                                </td>
                              ))}
                              <td className="px-3 py-3 text-right font-mono text-xs font-semibold text-slate-800">
                                {Number.isFinite(result.averageDiscrepancy) ? result.averageDiscrepancy.toFixed(3) : '\u2014'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
