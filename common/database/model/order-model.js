class OrderSummary {
    constructor({ orderId, status, totalCost }) {
        Object.assign(this, { orderId, status, totalCost });
    }
}

class Order {
    constructor({ orderId, status, customerId, totalCost, createdDate }) {
        Object.assign(this, { orderId, status, customerId, totalCost, createdDate });
    }
}

class OrderDetails extends Order {
    constructor(orderData) {
        super(orderData);
        this.items = [];
    }

    addItem(item) {
        this.items.push(item);
    }
}

class OrderItem {
    constructor({ productId, quantity, price }) {
        Object.assign(this, { productId, quantity, price });
    }
}

function mapOrder(rows, type) {
    const map = new Map();
    for (const row of rows) {
        if (!map.has(row.orderId)) {
            map.set(row.orderId, (() => {
                    switch(type){
                        case "ORDER_SUMMARY":
                            return new OrderSummary(row);
                        case "ORDER_LIST":
                            return new Order(row);
                        case "ORDER_DETAILS":
                            return new OrderDetails(row);
                    }
                })()
            );
        }
        if (type === "ORDER_DETAILS" && row.productId) {
            map.get(row.orderId).addItem(new OrderItem(row));
        }
    }
    return Array.from(map.values());
}

module.exports = {
    mapOrderSummary: (rows) => {
        return mapOrder(rows, "ORDER_SUMMARY")
    },
    mapOrders: (rows) => {
        return mapOrder(rows, "ORDER_LIST")
    },
    mapOrderDetails: (rows) => {
        return mapOrder(rows, "ORDER_DETAILS")
    }
};
