import React from "react";
import { getProcessColor } from "../utils/colors";

export default function MessageDeliveryTable({
  messages,
  processNames,
  selectedProcess,
  previousValues = [],
  finalValues = [],
  algorithm = null,
  knownValuesSets = null,
  leaderIndex = 0
}) {
  const filtered = selectedProcess != null
    ? messages.filter(m => m.from === selectedProcess || m.to === selectedProcess)
    : messages;

  const leaderName = processNames[leaderIndex] ?? (processNames[0] || "Leader");
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
    
    // Algoritmos especiales
    if (algorithm === "COURTEOUS") {
      const receivedVals = messagesByReceiver[toIdx] || [];
      const heard = [prevVal, ...receivedVals.map(v => v.value)];
      const zeros = heard.filter(v => v === 0).length;
      const ones = heard.filter(v => v === 1).length;

      if (zeros !== ones) {
        const majorityVal = zeros > ones ? 0 : 1;
        return changed
          ? `COURTEOUS: Adopted majority (${majorityVal})`
          : `COURTEOUS: Majority already ${majorityVal}`;
      }

      // No majority: courtesy flip
      const courtesyTarget = prevVal === 0 || prevVal === 1 ? 1 - prevVal : (prevVal >= 0.5 ? 0 : 1);
      return changed
        ? `COURTEOUS: No majority, flipped to ${courtesyTarget}`
        : "COURTEOUS: No majority, kept value";
    }

    if (["SELFISH", "CYCLIC", "BIASED0"].includes(algorithm)) {
      const receivedVals = messagesByReceiver[toIdx] || [];
      
      if (algorithm === "SELFISH") {
        if (!changed && receivedVals.length === 1 && sentVal !== prevVal) {

          const actualSender = receivedVals[0];
          return `SELFISH: Kept own value (ignoring ${processNames[actualSender.from]})`;
        } else if (changed && receivedVals.length === 2) {
          return "SELFISH: Majority decision (heard from all)";
        }
      } else if (algorithm === "CYCLIC") {
        const cyclicPrev = toIdx === 0 ? 2 : toIdx - 1;

        const actualSenderIdx = receivedVals.length > 0 ? receivedVals[0].from : fromIdx;
        
        if (changed && actualSenderIdx === cyclicPrev) {
          return `CYCLIC: Adopted from ${processNames[actualSenderIdx]} (cyclic order)`;
        } else if (!changed && actualSenderIdx !== cyclicPrev) {
          return `CYCLIC: Ignored ${processNames[actualSenderIdx]} (not in cyclic order)`;
        }
      } else if (algorithm === "BIASED0") {
        if (changed && newVal === 0) {

          const senderWith0 = receivedVals.find(v => v.value === 0);
          if (senderWith0) {
            return `BIASED0: Decided 0 (detected 0 from ${processNames[senderWith0.from]})`;
          }
          return `BIASED0: Decided 0`;
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
    } else if (algorithm === "LEADER") {
      if (toIdx === leaderIndex) {
        return "LEADER: Leader maintains own value";
      }
      const receivedVals = messagesByReceiver[toIdx] || [];
      const leaderMsg = receivedVals.find(m => m.from === leaderIndex);
      if (leaderMsg) {
        if (changed && newVal === leaderMsg.value) {
          return `LEADER: Adopted value from ${leaderName}`;
        }
        return `LEADER: Heard ${leaderName}`;
      }
      return `LEADER: No message from ${leaderName} - kept own value`;
    } else if (algorithm === "RECURSIVE AMP") {
      if (changed) {
        const receivedVals = messagesByReceiver[toIdx] || [];
        if (receivedVals.length > 0) {
          const allVals = [prevVal, ...receivedVals.map(r => r.value)];
          const minVal = Math.min(...allVals);
          const maxVal = Math.max(...allVals);
          return `RECURSIVE AMP: Applied a to range [${minVal.toFixed(3)}, ${maxVal.toFixed(3)}]`;
        }
      }
      return isDelivered ? "RECURSIVE AMP: value received" : "";
    } 
    
    // Algoritmos básicos AMP y FV
    if (changed) {
      const receivedMessages = messagesByReceiver[toIdx] || [];
      const differentValue = receivedMessages.find(m => m.value !== prevVal);
      
      if (algorithm === "AMP" && differentValue) {
        return `AMP: Moved to meeting point (received ${differentValue.value.toFixed(3)} -> ${prevVal.toFixed(3)})`;
      } else if (algorithm === "FV" && differentValue) {
        return `FV: Adopted received value ${differentValue.value.toFixed(3)}`;
      }
    }
    
    return "";
  };

  const getAlgorithmColor = () => {
    switch(algorithm) {
      case "MIN": return "text-yellow-700";
      case "RECURSIVE AMP": return "text-indigo-700";
      case "AMP": return "text-blue-700";
      case "FV": return "text-purple-700";
      case "LEADER": return "text-blue-700";
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
