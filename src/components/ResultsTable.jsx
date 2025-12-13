import React from "react";
import { ALICE_COLOR, BOB_COLOR, CHARLIE_COLOR } from "../utils/colors";

export default function ResultsTable({ experimentData, processCount = 2, forcedAlgorithm, fvMethod, rounds = 1 }) {
  const isCompactView = processCount > 6;

  if (!experimentData || !Array.isArray(experimentData) || experimentData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-400">No experiment data available</p>
      </div>
    );
  }

  const getDisplayedProcesses = () => {
    if (!isCompactView) return Array.from({ length: processCount }).map((_, i) => i);
    if (processCount <= 10) return [0, 1, Math.floor(processCount/2), processCount-2, processCount-1];
    return [0, 1, 2, Math.floor(processCount/3), Math.floor(2*processCount/3), processCount-2, processCount-1];
  };
  const displayedProcesses = getDisplayedProcesses();

  const processHeaders = displayedProcesses.map(idx => {
    const name = idx < 3 ? ["Alice", "Bob", "Charlie"][idx] : `P${idx+1}`;
    const color = idx < 3 ? [ALICE_COLOR, BOB_COLOR, CHARLIE_COLOR][idx] : "#666";
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
