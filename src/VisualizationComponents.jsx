// VisualizationComponents.jsx - Complete visualization components with fixed tooltips
import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  BarChart,
  Bar
} from 'recharts';

// Process colors
const processColors = [
  "#3498db", // Alice - Blue
  "#e67e22", // Bob - Orange
  "#2ecc71", // Charlie - Green
  "#9b59b6", // Purple
  "#e74c3c", // Red
  "#1abc9c", // Turquoise
  "#f39c12", // Yellow
  "#34495e", // Dark gray
  "#d35400", // Dark orange
  "#27ae60", // Dark green
  "#8e44ad", // Dark purple
  "#c0392b", // Dark red
  "#16a085", // Teal
  "#f1c40f", // Bright yellow
  "#2c3e50", // Dark blue
  "#95a5a6", // Light gray
  "#7f8c8d", // Medium gray
  "#bdc3c7", // Very light gray
  "#ecf0f1", // Almost white
  "#2980b9"  // Medium blue
];

// Main experiment visualization component
export function ExperimentVisualization({ history, processCount = 2 }) {
  // Validate data
  if (!history || history.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4 h-80 flex items-center justify-center">
        <p className="text-gray-500">No data to display</p>
      </div>
    );
  }

  // Transform data for chart
  const chartData = history.map((d, index) => {
    const round = d && typeof d.round === 'number' ? d.round : 0;
    const discrepancy = d && typeof d.discrepancy === 'number' ? d.discrepancy : 0;
    
    // Format adapted for n processes
    const data = { 
      round, 
      discrepancy,
      key: `round-${round}-${index}`
    };
    
    if (d && d.values) {
      d.values.forEach((val, idx) => {
        data[`p${idx}`] = val;
      });
    }
    
    return data;
  });

  // Function to generate process name by index
  const getProcessName = (index) => {
    if (index < 3) {
      return ["Alice", "Bob", "Charlie"][index];
    } else if (index < 26) {
      return `P-${String.fromCharCode(65 + index)}`;
    } else {
      return `P-${index + 1}`;
    }
  };

  // Determine if legend should be compact
  const useTwoColumnLegend = processCount > 5;

  // Create unique key for LineChart based on data
  const chartKey = `chart-${processCount}-${history.length}-${Date.now()}`;

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
        <LineChart 
          key={chartKey} 
          data={chartData} 
          margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="round" />
          <YAxis domain={[0, 1]} />
          <Tooltip 
            formatter={(value) => {
              if (value === undefined || value === null || isNaN(value)) {
                return 'N/A';
              }
              return Number(value).toFixed(4);
            }}
            labelFormatter={(value) => `Round: ${value}`}
            isAnimationActive={false}
            content={({ active, payload, label }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-white p-2 border border-gray-200 rounded shadow-sm">
                    <p className="font-semibold">{`Round: ${label}`}</p>
                    {payload.map((entry, index) => (
                      <p key={`tooltip-${entry.dataKey}-${index}`} style={{ color: entry.color }}>
                        {`${entry.name}: ${entry.value !== undefined && !isNaN(entry.value) ? 
                          Number(entry.value).toFixed(4) : 'N/A'}`}
                      </p>
                    ))}
                  </div>
                );
              }
              return null;
            }}
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
          
          {/* Render line for each process */}
          {Array.from({ length: Math.min(processCount, 20) }).map((_, index) => {
            const name = getProcessName(index);
            const strokeWidth = index < 3 ? 2.5 : 1.5;
            const strokeDasharray = index > 10 ? "3 3" : null;
              
            return (
              <Line 
                key={`line-${index}-${name}`}
                type="monotone" 
                dataKey={`p${index}`} 
                name={name} 
                stroke={processColors[index % processColors.length]} 
                strokeWidth={strokeWidth}
                strokeDasharray={strokeDasharray}
                dot={{ r: index < 3 ? 3 : 2 }}
                isAnimationActive={false}
              />
            );
          })}
          
          {/* Max discrepancy line */}
          <Line 
            key="discrepancy-line"
            type="monotone" 
            dataKey="discrepancy" 
            name="Max Discrepancy" 
            stroke="#e74c3c" 
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 4, fill: '#e74c3c' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Theory vs Experiment comparison chart
export function TheoryVsExperimentChart({ results, maxRounds, probability }) {
  if (!results || !results.comparisonResults) {
    return (
      <div className="bg-white rounded-lg shadow p-4 h-80 flex items-center justify-center">
        <p className="text-gray-500">No comparison data available</p>
      </div>
    );
  }

  const chartKey = `theory-exp-${probability}-${maxRounds}-${Date.now()}`;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-lg font-semibold mb-4">Theory vs Experiment Comparison</h3>
      
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            key={chartKey}
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
            <Tooltip 
              formatter={(value) => {
                if (value === undefined || value === null || isNaN(value)) {
                  return 'N/A';
                }
                return Number(value).toFixed(6);
              }}
              labelFormatter={(label) => `Round: ${label}`}
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white p-2 border border-gray-200 rounded shadow-sm">
                      <p className="font-semibold">{`Round: ${label}`}</p>
                      {payload.map((entry, index) => (
                        <p key={`tooltip-${entry.dataKey}-${index}-${label}`} style={{ color: entry.color }}>
                          {`${entry.name}: ${entry.value !== undefined && !isNaN(entry.value) ? 
                            Number(entry.value).toFixed(6) : 'N/A'}`}
                        </p>
                      ))}
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="theoretical"
              name="Theoretical"
              stroke="#3498db"
              strokeWidth={2}
              dot={{ r: 4 }}
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="experimental"
              name="Experimental"
              stroke="#e74c3c"
              strokeWidth={2}
              dot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
        <div className="bg-gray-50 p-3 rounded">
          <h4 className="font-medium mb-1">Algorithm</h4>
          <p>{results.algorithm || 'Auto'}</p>
        </div>
        <div className="bg-gray-50 p-3 rounded">
          <h4 className="font-medium mb-1">Probability (p)</h4>
          <p>{probability.toFixed(2)}</p>
        </div>
      </div>
    </div>
  );
}

// Warning component for theory limitations
export function TheoryLimitationWarning({ processCount, show = true }) {
  if (!show || processCount <= 3) {
    return null;
  }
  
  const expectedError = processCount === 4 ? "20-30%" : 
                       processCount === 5 ? "30-40%" : 
                       ">40%";
  
  return (
    <div className="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-yellow-800">
            Known Theoretical Limitation for {processCount} Processes
          </h3>
          <div className="mt-2 text-sm text-yellow-700">
            <p>
              The paper's theoretical formulas are approximations that lose accuracy with more than 3 processes.
              For {processCount} processes, expect discrepancies of approximately <strong>{expectedError}</strong> between 
              theory and experiment.
            </p>
            <p className="mt-2">
              <strong>Note:</strong> This is a limitation of the theoretical model, not a simulator error. 
              The experimental results remain valid and scientifically correct.
            </p>
          </div>
          <details className="mt-2">
            <summary className="text-sm text-yellow-600 cursor-pointer hover:text-yellow-800">
              More information...
            </summary>
            <div className="mt-2 text-xs text-yellow-600 space-y-1">
              <p>• Formulas assume independence between decisions that doesn't hold for n 3</p>
              <p>• Cascade effects and complex correlations are not modeled</p>
              <p>• The factor C = q^(m×(n-m)) in FV is an over-simplification</p>
              <p>• Combinatorial complexity grows exponentially with n</p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}

// Table showing expected errors by process count
export function ExpectedErrorTable({ maxProcesses = 6 }) {
  const errorData = [
    { n: 2, expected: "< 5%", status: "✅ Excellent", color: "text-green-600" },
    { n: 3, expected: "< 10%", status: "✅ Good", color: "text-green-600" },
    { n: 4, expected: "20-30%", status: "⚠️ Limited", color: "text-yellow-600" },
    { n: 5, expected: "30-40%", status: "❌ High", color: "text-red-600" },
    { n: 6, expected: "> 40%", status: "❌ Very High", color: "text-red-600" }
  ];
  
  return (
    <div className="mt-4 overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
      <table className="min-w-full divide-y divide-gray-300">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
              Processes (n)
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
              Expected Error
            </th>
            <th className="px-3 py-3 text-left text-xs font-medium text-gray-900 uppercase tracking-wider">
              Status
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {errorData.slice(0, maxProcesses - 1).map((row) => (
            <tr key={row.n}>
              <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                {row.n}
              </td>
              <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                {row.expected}
              </td>
              <td className={`px-3 py-2 whitespace-nowrap text-sm font-medium ${row.color}`}>
                {row.status}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Hook to manage theory limitation warning
export function useTheoryLimitationWarning(processCount) {
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [showWarning, setShowWarning] = React.useState(true);
  
  React.useEffect(() => {
    if (processCount <= 3) {
      setAcknowledged(false);
      setShowWarning(false);
    } else if (processCount > 3 && !acknowledged) {
      setShowWarning(true);
    }
  }, [processCount, acknowledged]);
  
  const dismissWarning = () => {
    setAcknowledged(true);
    setShowWarning(false);
  };
  
  return {
    showWarning,
    dismissWarning,
    shouldWarn: processCount > 3
  };
}

// Histogram component for statistical analysis
export function DiscrepancyHistogram({ data, theoretical = null, experimental = null }) {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-4 h-64 flex items-center justify-center">
        <p className="text-gray-500">No data to display</p>
      </div>
    );
  }

  // Create histogram bins
  const binCount = 20;
  const histogram = {};
  const min = Math.min(...data);
  const max = Math.max(...data);
  const binSize = (max - min) / binCount;

  // Initialize bins
  for (let i = 0; i < binCount; i++) {
    const binStart = min + i * binSize;
    histogram[binStart.toFixed(3)] = 0;
  }

  // Fill bins
  data.forEach(value => {
    const binIndex = Math.floor((value - min) / binSize);
    const binKey = (min + binIndex * binSize).toFixed(3);
    if (histogram[binKey] !== undefined) {
      histogram[binKey]++;
    }
  });

  // Convert to chart data
  const chartData = Object.entries(histogram).map(([bin, count]) => ({
    bin: parseFloat(bin),
    count,
    binLabel: `${parseFloat(bin).toFixed(3)}-${(parseFloat(bin) + binSize).toFixed(3)}`
  }));

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h4 className="text-sm font-medium mb-2">Discrepancy Distribution</h4>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis 
            dataKey="bin" 
            tickFormatter={(value) => value.toFixed(2)}
          />
          <YAxis />
          <Tooltip 
            formatter={(value) => `Count: ${value}`}
            labelFormatter={(value) => `Range: ${value.toFixed(3)}`}
          />
          <Bar dataKey="count" fill="#3498db" />
          {theoretical && (
            <ReferenceLine 
              x={theoretical} 
              stroke="red" 
              strokeWidth={2} 
              strokeDasharray="5 5" 
              label={{ value: "Theoretical", position: "top" }}
            />
          )}
          {experimental && (
            <ReferenceLine 
              x={experimental} 
              stroke="green" 
              strokeWidth={2} 
              strokeDasharray="5 5" 
              label={{ value: "Experimental", position: "top" }}
            />
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}