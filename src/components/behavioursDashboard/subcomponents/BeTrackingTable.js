import React, { useState, useEffect, Fragment} from 'react';

const BeTrackingTable = ({filteredData, cleanDuplicateText, storageKey = 'behaviours_checked_items'}) => {
    const [checkedItems, setCheckedItems] = useState(new Set());
    const [expandedNotes, setExpandedNotes] = useState({});

    // Load checked items from localStorage on component mount
    useEffect(() => {
        try {
            const savedCheckedItems = localStorage.getItem(storageKey);
            if (savedCheckedItems) {
                const parsedItems = JSON.parse(savedCheckedItems);
                setCheckedItems(new Set(parsedItems));
            }
        } catch (error) {
            console.error('Error loading checked items from localStorage:', error);
        }
    }, [storageKey]);

    // Save checked items to localStorage whenever checkedItems changes
    useEffect(() => {
        try {
            localStorage.setItem(storageKey, JSON.stringify([...checkedItems]));
        } catch (error) {
            console.error('Error saving checked items to localStorage:', error);
        }
    }, [checkedItems, storageKey]);

    // Handle checkbox change
    const handleCheckboxChange = (incidentNumber) => {
        setCheckedItems(prev => {
            const newCheckedItems = new Set(prev);
            if (newCheckedItems.has(incidentNumber)) {
                newCheckedItems.delete(incidentNumber);
            } else {
                newCheckedItems.add(incidentNumber);
            }
            return newCheckedItems;
        });
    };

    // Clear all checked items (optional utility function)
    const clearAllChecked = () => {
        setCheckedItems(new Set());
    };

    // Toggle expanded state for a specific note
    const toggleExpanded = (incidentNumber) => {
        setExpandedNotes(prev => ({
            ...prev,
            [incidentNumber]: !prev[incidentNumber]
        }));
    };

    return (
        <div>
                {/* Optional: Add a utility button to clear all checked items */}
                {checkedItems.size > 0 && (
                <div style={s.clearButtonContainer}>
                    <button
                        onClick={clearAllChecked}
                        style={s.clearAllCheckedButton}
                    >
                        Clear All Checked ({checkedItems.size})
                    </button>
            </div>
            )}

            <table style={s.table}>
                <thead>
                    <tr>
                        <th style={{ ...s.tableHeader, ...s.tableHeaderCheckbox }}>✓</th>
                        <th style={s.tableHeader}>#</th>
                        <th style={s.tableHeader}>Name</th>
                        <th style={s.tableHeader}>Date</th>
                        <th style={s.tableHeader}>Location</th>
                        <th style={s.tableHeader}>Type</th>
                        <th style={s.tableHeader}>Who Affected</th>
                        <th style={s.tableHeader}>PRN</th>
                        <th style={s.tableHeader}>Code White</th>
                        <th style={s.tableHeader}>Summary</th>
                        <th style={s.tableHeader}>Triggers</th>
                        <th style={s.tableHeader}>Interventions</th>
                        <th style={s.tableHeader}>Injuries</th>
                        <th style={s.tableHeader}>Potential CI</th>
                        {/* Conditionally render Other Notes header if any item has other_notes */}
                        {filteredData && filteredData.some(item => item.other_notes) && (
                            <th style={s.tableHeader}>Other Notes</th>
                        )}
                    </tr>
                </thead>
                <tbody id="fallsTableBody">
                    {filteredData && filteredData.map((item, i) => {
                        const isChecked = checkedItems.has(item.incident_number);
                        const rowStyle = isChecked ? s.checkedRow : {}; // Base checked row style

                        const summaryBgColor = item.summary?.includes('No Progress') && item.summary?.includes('24hrs of RIM') ? s.highlightRed : {};
                        const triggersBgColor = cleanDuplicateText(item.triggers, 'triggers')?.includes('No Progress') && cleanDuplicateText(item.triggers, 'triggers')?.includes('24hrs of RIM') ? s.highlightRed : {};
                        const interventionsBgColor = cleanDuplicateText(item.interventions, 'interventions')?.includes('No Progress') && cleanDuplicateText(item.interventions, 'interventions')?.includes('24hrs of RIM') ? s.highlightRed : {};

                        const evenRowStyle = i % 2 === 1 ? s.evenRow : {}; // Apply even row background

                        return (
                            <tr key={i} style={{ ...evenRowStyle, ...rowStyle }}>
                                <td style={{ ...s.tableCell, ...s.checkboxCell }}>
                                    <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={() => handleCheckboxChange(item.incident_number)}
                                        style={s.checkboxInput}
                                    />
                                </td>
                                <td style={s.tableCell}>{item.incident_number}</td>
                                <td style={s.tableCell}>{item.name}</td>
                                <td style={s.tableCell}>{item.date}</td>
                                <td style={s.tableCell}>{item.incident_location}</td>
                                <td style={s.tableCell}>{item.incident_type}</td>
                                <td style={s.tableCell}>{item.who_affected}</td>
                                <td style={s.tableCell}>{item.prn}</td>
                                <td style={s.tableCell}>{item.code_white}</td>
                                <td style={{ ...s.tableCell, ...summaryBgColor }}>{item.summary}</td>
                                <td style={{ ...s.tableCell, ...triggersBgColor }}>{cleanDuplicateText(item.triggers, 'triggers')}</td>
                                <td style={{ ...s.tableCell, ...interventionsBgColor }}>{cleanDuplicateText(item.interventions, 'interventions')}</td>
                                <td style={s.tableCell}>{item.injuries}</td>
                                <td style={s.tableCell}>{item.CI || "Still Gathering Data/Unknown"}</td>
                                {/* Conditionally render Other Notes cell if any item has other_notes */}
                                {filteredData && filteredData.some(dataItem => dataItem.other_notes) && (
                                    <td style={{ ...s.tableCell, whiteSpace: 'pre-wrap' }}>
                                        {item.other_notes ? 
                                            (() => {
                                                const cleanedText = item.other_notes
                                                    .replace(/<br\s*\/?>/gi, '\n')
                                                    .replace(/note text\s*:\s*/gi, '')
                                                    .replace(/202[4-5]-/g, '');
                                                
                                                const expanded = expandedNotes[item.incident_number] || false;
                                                const maxLength = 200;
                                                const shouldTruncate = cleanedText.length > maxLength;
                                                const displayText = expanded || !shouldTruncate ? cleanedText : cleanedText.slice(0, maxLength) + '...';
                                                
                                                return (
                                                    <div style={{ cursor: 'pointer', position: 'relative', zIndex: 10 }} onClick={() => toggleExpanded(item.incident_number)}>
                                                        {displayText
                                                        }

                                                    <br/>   
                                                        {shouldTruncate && (
                                                            <>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        toggleExpanded(item.incident_number);
                                                                    }}
                                                                    style={{
                                                                        background: 'none',
                                                                        border: 'none',
                                                                        color: '#007bff',
                                                                        cursor: 'pointer',
                                                                        textDecoration: 'underline',
                                                                        padding: 0,
                                                                        fontSize: '12px',
                                                                        position: 'relative',
                                                                        zIndex: 10
                                                                    }}
                                                                >
                                                                    {expanded ? 'Show less' : 'Show more'}
                                                                </button>
                                                            </>
                                                        )}
                                                    </div>
                                                );
                                            })()
                                            : ''
                                        }
                                    </td>
                                )}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

const s = {
    clearButtonContainer: {
        marginBottom: '10px',
        textAlign: 'right',
    },
    clearAllCheckedButton: {
        padding: '5px 10px',
        backgroundColor: '#6c757d',
        color: 'white',
        border: 'none',
        borderRadius: '3px',
        cursor: 'pointer',
        fontSize: '12px',
        transition: 'background-color 0.2s ease-in-out',
    },
    table: {
        width: '100%',
        borderCollapse: 'collapse',
        marginTop: '20px',
        fontSize: '13px',
        tableLayout: 'auto',
    },
    tableHeader: {
        border: '1px solid #ddd',
        padding: '4px 2px',
        textAlign: 'center',
        backgroundColor: '#e8f5e9',
        fontWeight: '600',
        fontSize: '13px',
        verticalAlign: 'middle',
        whiteSpace: 'nowrap',
    },
    tableHeaderCheckbox: {
        textAlign: 'center',
        width: '25px',
        padding: '2px',
    },
    tableCell: {
        border: '1px solid #ddd',
        padding: '4px 2px',
        textAlign: 'left',
        fontSize: '14px',
        verticalAlign: 'top',
        maxWidth: '120px',
    },
    checkboxCell: {
        textAlign: 'center',
        width: '25px',
        padding: '2px',
        verticalAlign: 'middle',
    },
    checkboxInput: {
        width: '18px',
        height: '18px',
        cursor: 'pointer',
        verticalAlign: 'middle',
    },
    checkedRow: {
        opacity: '0.6',
        backgroundColor: '#f8f9fa',
        textDecoration: 'line-through',
    },
    evenRow: {
        backgroundColor: '#f8f8f8',
    },
    highlightRed: {
        backgroundColor: '#ffcdd2',
    },
};

export default BeTrackingTable;