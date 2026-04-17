import swaggerJSDoc from 'swagger-jsdoc';
import { env } from '@/config/env';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Urban Harvest Hub API',
      version: '1.0.0',
      description:
        'Backend API for Urban Harvest Hub – an interactive urban farming platform where vendors rent garden plots, grow produce, sell organic products, and share sustainable farming practices.',
      contact: {
        name: 'Urban Harvest Hub Team',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}/api/${env.API_VERSION}`,
        description: 'Development Server',
      },
      {
        url: `https://your-production-domain.com/api/${env.API_VERSION}`,
        description: 'Production Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT access token',
        },
      },
      schemas: {
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            statusCode: { type: 'integer', example: 200 },
            message: { type: 'string', example: 'Request successful' },
            data: { type: 'object' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            statusCode: { type: 'integer', example: 400 },
            message: { type: 'string', example: 'Something went wrong' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            statusCode: { type: 'integer', example: 200 },
            message: { type: 'string' },
            data: { type: 'array', items: {} },
            meta: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                page: { type: 'integer' },
                limit: { type: 'integer' },
                totalPages: { type: 'integer' },
              },
            },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth', description: 'Authentication endpoints' },
      { name: 'Users', description: 'User profile management' },
      { name: 'Vendors', description: 'Vendor management' },
      { name: 'Farms', description: 'Farm management' },
      { name: 'Garden Spaces', description: 'Garden plot management' },
      { name: 'Bookings', description: 'Plot booking management' },
      { name: 'Plant Tracking', description: 'Plant growth tracking' },
      { name: 'Products', description: 'Marketplace products' },
      { name: 'Cart', description: 'Shopping cart' },
      { name: 'Orders', description: 'Order management' },
      { name: 'Certifications', description: 'Organic certification management' },
      { name: 'Forum', description: 'Community forum' },
      { name: 'Notifications', description: 'Notification system' },
      { name: 'Reviews', description: 'Review and rating system' },
      { name: 'Admin', description: 'Admin-only endpoints' },
    ],
  },
  apis: ['./src/modules/**/*.ts', './src/routes/*.ts'],
};

export const swaggerSpec = swaggerJSDoc(options);
