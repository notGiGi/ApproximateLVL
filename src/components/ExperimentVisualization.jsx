import React from "react";
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, Line } from "recharts";
import { ALICE_COLOR, BOB_COLOR, CHARLIE_COLOR } from "../utils/colors";

export default function ExperimentVisualization({ experimentData, currentRound = 0, processCount = 2 }) {
  if (!experimentData || !Array.isArray(experimentData) || experimentData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-400">No experiment data available</p>
      </div>
    );
  }

  const roundData = experimentData.slice(0, Math.min(currentRound + 1, experimentData.length));

  const generateProcessColors = (count) => {
    const baseColors = [
      ALICE_COLOR, BOB_COLOR, CHARLIE_COLOR, 
      "#9c27b0", "#e91e63", "#f44336", "#ff9800",
      "#ffc107", "#8bc34a", "#009688", "#03a9f4",
      "#673ab7", "#795548", "#607d8b", "#ff5722"
    ];

    if (count > baseColors.length) {
      const extraColors = [];
      for (let i = 0; i < count - baseColors.length; i++) {
        const h = (i * 137.5) % 360;
        const s = 75 + Math.random() * 15;
        const l = 45 + Math.random() * 10;
        extraColors.push(`hsl(${h}, ${s}%, ${l}%)`);
      }
      return [...baseColors, ...extraColors];
    }
    return baseColors.slice(0, count);
  };
  
  const processColors = generateProcessColors(processCount);
  
  const chartData = roundData.map(d => {
    const round = d && typeof d.round === 'number' ? d.round : 0;
    const discrepancy = d && typeof d.discrepancy === 'number' ? d.discrepancy : 0;
    const data = { round, discrepancy };
    if (d && d.values) {
      d.values.forEach((val, idx) => {
        data[`p${idx}`] = val;
      });
    }
    return data;
  });

  const getProcessName = (index) => {
    if (index < 3) return ["Alice", "Bob", "Charlie"][index];
    if (index < 26) return `P-${String.fromCharCode(65 + index)}`;
    return `P-${index + 1}`;
  };

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
            isAnimationActive={false}
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
          {Array.from({ length: Math.min(processCount, 20) }).map((_, index) => {
            const name = getProcessName(index);
            const strokeWidth = index < 3 ? 2.5 : 1.5;
            const strokeDasharray = index > 10 ? "3 3" : null;
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
                strokeDasharray={strokeDasharray}
              />
            );
          })}
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
