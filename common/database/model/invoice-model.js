const constants = require("../../constants");

class InvoiceSummary {
    constructor({ invoiceId, status, totalCost, dueDate }) {
        Object.assign(this, { invoiceId, status, totalCost, dueDate });
    }
}

function mapInvoice(rows, type) {
    const map = new Map();
    for (const row of rows) {
        if (!map.has(row.invoiceId)) {
            map.set(row.invoiceId, (() => {
                    switch(type){
                        case constants.MODEL_CONSTANTS.INVOICE_SUMMARY:
                            return new InvoiceSummary(row);
                    }
                })()
            );
        }
    }
    return Array.from(map.values());
}

module.exports = {
    mapInvoiceSummary: (rows) => {
        return mapInvoice(rows, constants.MODEL_CONSTANTS.INVOICE_SUMMARY)
    }
};