import React from 'react';

const BeFollowUpTable = ({ filteredData, DUMMY_FOLLOW_UP_DATA, followUpLoading }) => {
    return (
        <div>
            {followUpLoading ? (
                <div style={{ textAlign: 'center', padding: '20px' }}>Loading follow-up data...</div>
            ) : filteredData.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>No follow-up data available</div>
            ) : (
                <table style={s.table}>
                    <thead>
                        <tr>
                            <th style={s.tableHeader}>#</th>
                            <th style={s.tableHeader}>Resident Name</th>
                            <th style={s.tableHeader}>Date</th>
                            <th style={s.tableHeader}>Summary</th>
                            <th style={s.tableHeader}>Other Notes Included</th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* Use Firebase data if available, otherwise show dummy data */}
                        {filteredData.map((item, index) => (
                            <tr key={item.id || index} style={index % 2 === 1 ? s.evenRow : {}}>
                                <td style={s.tableCell}>{index + 1}</td>
                                <td style={s.tableCell}>{item.resident_name || ''}</td>
                                <td style={s.tableCell}>{item.date || ''}</td>
                                <td style={s.tableCell}>{item.summary_of_behaviour || ''}</td>
                                <td style={s.tableCell}>{item.other_notes ? item.other_notes.replace(/note text\s*:\s*/gi, '') : ''}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

const s = {
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
        // verticalAlign: 'middle',
        // whiteSpace: 'nowrap',
    },
    tableCell: {
        border: '1px solid #ddd',
        padding: '4px 2px',
        textAlign: 'left',
        fontSize: '14px',
        verticalAlign: 'top',
        // maxWidth: '120px',
        overflow: 'hidden',
        // textOverflow: 'ellipsis',
        // whiteSpace: 'nowrap',
    },
    evenRow: {
        backgroundColor: '#f8f8f8',
    },
};

export default BeFollowUpTable;
