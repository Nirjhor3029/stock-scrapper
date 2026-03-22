require('dotenv').config();

const app = require('./src/app');
const connectDB = require('./src/config/database');
const config = require('./src/config');
const logger = require('./src/utils/logger');

// Start server
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Start Express server
    const server = app.listen(config.port, () => {
      logger.info(`Server running in ${config.env} mode on port ${config.port}`);
      logger.info(`Health check: http://localhost:${config.port}/health`);
      logger.info(`API documentation: http://localhost:${config.port}/api`);
    });
    
    // Graceful shutdown
    const gracefulShutdown = () => {
      logger.info('Received shutdown signal. Starting graceful shutdown...');
      
      server.close(() => {
        logger.info('HTTP server closed.');
        
        // Close database connection
        const mongoose = require('mongoose');
        mongoose.connection.close(false, () => {
          logger.info('MongoDB connection closed.');
          process.exit(0);
        });
      });
      
      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout.');
        process.exit(1);
      }, 10000);
    };
    
    // Handle shutdown signals
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();