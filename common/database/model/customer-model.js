const constants = require("../../constants");

class CustomerPermission {
    constructor({ customerId, userId }) {
        Object.assign(this, { customerId, userId });
        this.permissions = [];
    }

    addPermission(permission) {
        this.permissions.push(permission);
    }
}

class Permision {
    constructor({ permissionId, permissionName }) {
        Object.assign(this, { permissionId, permissionName });
    }
}

function mapCustomer(rows, type) {
    const map = new Map();
    for (const row of rows) {
        if (!map.has(row.customerId)) {
            map.set(row.customerId, (() => {
                    switch(type){
                        case constants.MODEL_CONSTANTS.CUSTOMER_PERMISSION:
                            return new CustomerPermission(row);
                    }
                })()
            );
        }
        if (type === constants.MODEL_CONSTANTS.CUSTOMER_PERMISSION && row.permissionId) {
            map.get(row.customerId).addPermission(new Permision(row));
        }
    }
    return Array.from(map.values());
}

module.exports = {
    mapCustomerPermissions: (rows) => {
        return mapCustomer(rows, constants.MODEL_CONSTANTS.CUSTOMER_PERMISSION)
    }
};