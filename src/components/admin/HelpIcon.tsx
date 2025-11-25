'use client';

import React, { useState } from 'react';

interface HelpIconProps {
  content: string;
  title?: string;
}

export default function HelpIcon({ content, title = 'Help' }: HelpIconProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  // Parse content to handle bullet points properly
  const renderContent = () => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let currentList: string[] = [];
    let currentText: string[] = [];

    const flushList = () => {
      if (currentList.length > 0) {
        elements.push(
          <ul key={`list-${elements.length}`} className="list-disc list-inside mb-2 space-y-1 ml-2">
            {currentList.map((item, i) => (
              <li key={i} className="text-gray-600">{item}</li>
            ))}
          </ul>
        );
        currentList = [];
      }
    };

    const flushText = () => {
      if (currentText.length > 0) {
        elements.push(
          <div key={`text-${elements.length}`} className="mb-2 text-gray-600">
            {currentText.join(' ')}
          </div>
        );
        currentText = [];
      }
    };

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      
      if (trimmedLine === '') {
        // Empty line - flush both list and text
        flushList();
        flushText();
      } else if (trimmedLine.startsWith('•')) {
        // Bullet point - flush text first, then add to list
        flushText();
        const listItem = trimmedLine.substring(1).trim();
        currentList.push(listItem);
      } else {
        // Regular text - flush list first, then add to text
        flushList();
        currentText.push(trimmedLine);
      }
    });

    // Flush any remaining content
    flushList();
    flushText();

    return elements.length > 0 ? elements : <div className="text-gray-600">{content}</div>;
  };

  return (
    <div className="relative inline-block">
      <button
        type="button"
        className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-200 hover:bg-gray-300 text-gray-600 hover:text-gray-800 transition-colors text-xs font-medium ml-2"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={() => setShowTooltip(!showTooltip)}
        aria-label="Help"
      >
        ?
      </button>
      {showTooltip && (
        <div className="absolute z-50 w-64 p-3 mt-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg shadow-lg left-0 top-full">
          <div className="font-semibold text-gray-900 mb-2">{title}</div>
          <div className="text-gray-600">
            {renderContent()}
          </div>
          <div className="absolute -top-1 left-4 w-2 h-2 bg-white border-l border-t border-gray-300 transform rotate-45"></div>
        </div>
      )}
    </div>
  );
}

