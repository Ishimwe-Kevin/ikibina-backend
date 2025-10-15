import AuditTrail from "../models/auditTrail.model.js";

/**
 * Create an audit trail entry
 * @param {Object} params - Parameters for creating audit trail
 * @param {String} params.userId - ID of the user performing the action
 * @param {String} params.action - Action performed (create, update, delete, etc.)
 * @param {String} params.entityType - Type of entity (user, group, contribution, etc.)
 * @param {String} params.entityId - ID of the entity
 * @param {String} params.description - Description of the action
 * @param {Object} [params.previousState] - Previous state of the entity (for updates)
 * @param {Object} [params.newState] - New state of the entity (for updates)
 * @param {String} [params.ipAddress] - IP address of the user
 * @param {String} [params.userAgent] - User agent of the user
 * @returns {Promise<Object>} - Created audit trail entry
 */
export const createAuditEntry = async (params) => {
    try {
        const auditTrail = new AuditTrail({
            user: params.userId,
            action: params.action,
            entityType: params.entityType,
            entityId: params.entityId,
            description: params.description,
            previousState: params.previousState,
            newState: params.newState,
            ipAddress: params.ipAddress,
            userAgent: params.userAgent,
        });

        await auditTrail.save();
        return auditTrail;
    } catch (error) {
        console.error("Error creating audit trail:", error);
        // Don't throw error to prevent disrupting main functionality
        return null;
    }
};

/**
 * Create a middleware function to automatically create audit trails for specific routes
 * @param {Object} options - Options for the middleware
 * @param {String} options.action - Action performed (create, update, delete, etc.)
 * @param {String} options.entityType - Type of entity (user, group, contribution, etc.)
 * @param {Function} options.getEntityId - Function to extract entity ID from request/response
 * @param {Function} options.getDescription - Function to generate description from request/response
 * @param {Function} [options.getPreviousState] - Function to get previous state (for updates)
 * @param {Function} [options.getNewState] - Function to get new state (for updates)
 * @returns {Function} - Express middleware function
 */
export const createAuditMiddleware = (options) => {
    return async (req, res, next) => {
        // Store original send method
        const originalSend = res.send;
        
        // Override send method to capture response
        res.send = function(data) {
            // Only create audit trail for successful responses
            if (res.statusCode >= 200 && res.statusCode < 300) {
                try {
                    const userId = req.user?.id;
                    if (!userId) return originalSend.apply(res, arguments);
                    
                    // Parse response data
                    const responseData = typeof data === 'string' ? JSON.parse(data) : data;
                    
                    // Get entity ID and description using provided functions
                    const entityId = options.getEntityId(req, responseData);
                    if (!entityId) return originalSend.apply(res, arguments);
                    
                    const description = options.getDescription(req, responseData);
                    
                    // Get previous and new states if functions are provided
                    const previousState = options.getPreviousState ? 
                        options.getPreviousState(req, responseData) : undefined;
                    
                    const newState = options.getNewState ? 
                        options.getNewState(req, responseData) : undefined;
                    
                    // Create audit trail asynchronously
                    createAuditEntry({
                        userId,
                        action: options.action,
                        entityType: options.entityType,
                        entityId,
                        description,
                        previousState,
                        newState,
                        ipAddress: req.ip,
                        userAgent: req.headers["user-agent"]
                    }).catch(err => {
                        console.error("Error in audit middleware:", err);
                    });
                } catch (error) {
                    console.error("Error in audit middleware:", error);
                }
            }
            
            // Call original send method
            return originalSend.apply(res, arguments);
        };
        
        next();
    };
};

/**
 * Create an audit trail for payment transactions
 * @param {Object} params - Payment transaction details
 * @param {String} params.userId - ID of the user performing the payment
 * @param {String} params.paymentId - ID of the payment
 * @param {String} params.paymentType - Type of payment (contribution, withdrawal, etc.)
 * @param {Number} params.amount - Amount of the payment
 * @param {String} params.status - Status of the payment
 * @param {String} [params.description] - Description of the payment
 * @returns {Promise<Object>} - Created audit trail entry
 */
export const createPaymentAuditTrail = async (params) => {
    try {
        const description = params.description || 
            `${params.paymentType} payment of ${params.amount} - Status: ${params.status}`;
        
        return await createAuditEntry({
            userId: params.userId,
            action: "payment",
            entityType: "payment",
            entityId: params.paymentId,
            description
        });
    } catch (error) {
        console.error("Error creating payment audit trail:", error);
        return null;
    }
};

/**
 * Create an audit trail for user authentication events
 * @param {Object} params - Authentication event details
 * @param {String} params.userId - ID of the user
 * @param {String} params.action - Action performed (login, logout, password_change)
 * @param {String} params.ipAddress - IP address of the user
 * @param {String} params.userAgent - User agent of the user
 * @returns {Promise<Object>} - Created audit trail entry
 */
export const createAuthAuditTrail = async (params) => {
    try {
        const description = `User ${params.action} event`;
        
        return await createAuditEntry({
            userId: params.userId,
            action: params.action,
            entityType: "user",
            entityId: params.userId,
            description,
            ipAddress: params.ipAddress,
            userAgent: params.userAgent
        });
    } catch (error) {
        console.error("Error creating auth audit trail:", error);
        return null;
    }
};

/**
 * Create an audit trail for settings changes
 * @param {Object} params - Settings change details
 * @param {String} params.userId - ID of the user making the change
 * @param {String} params.entityType - Type of entity (user, group)
 * @param {String} params.entityId - ID of the entity
 * @param {Object} params.previousSettings - Previous settings
 * @param {Object} params.newSettings - New settings
 * @returns {Promise<Object>} - Created audit trail entry
 */
export const createSettingsAuditTrail = async (params) => {
    try {
        const description = `${params.entityType} settings updated`;
        
        return await createAuditEntry({
            userId: params.userId,
            action: "settings_change",
            entityType: params.entityType,
            entityId: params.entityId,
            description,
            previousState: params.previousSettings,
            newState: params.newSettings
        });
    } catch (error) {
        console.error("Error creating settings audit trail:", error);
        return null;
    }
};