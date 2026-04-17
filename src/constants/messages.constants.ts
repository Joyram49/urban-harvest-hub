export const MESSAGES = {
  // Generic
  SUCCESS: 'Request successful',
  CREATED: 'Resource created successfully',
  UPDATED: 'Resource updated successfully',
  DELETED: 'Resource deleted successfully',
  NOT_FOUND: 'Resource not found',
  FORBIDDEN: 'You do not have permission to perform this action',
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again later.',

  // Auth
  AUTH: {
    REGISTER_SUCCESS: 'Registration successful. Please verify your email.',
    LOGIN_SUCCESS: 'Login successful',
    LOGOUT_SUCCESS: 'Logged out successfully',
    TOKEN_REFRESHED: 'Access token refreshed',
    PASSWORD_CHANGED: 'Password changed successfully',
    PASSWORD_RESET_SENT: 'Password reset link sent to your email',
    PASSWORD_RESET_SUCCESS: 'Password reset successful',
    EMAIL_VERIFIED: 'Email verified successfully',
    INVALID_CREDENTIALS: 'Invalid email or password',
    ACCOUNT_NOT_VERIFIED: 'Please verify your email before logging in',
    ACCOUNT_SUSPENDED: 'Your account has been suspended. Contact support.',
    TOKEN_EXPIRED: 'Token has expired',
    TOKEN_INVALID: 'Invalid token',
  },

  // User
  USER: {
    PROFILE_FETCHED: 'Profile fetched successfully',
    PROFILE_UPDATED: 'Profile updated successfully',
    AVATAR_UPDATED: 'Profile image updated successfully',
  },

  // Vendor
  VENDOR: {
    CREATED: 'Vendor profile created successfully',
    FETCHED: 'Vendor fetched successfully',
    LIST_FETCHED: 'Vendors fetched successfully',
    UPDATED: 'Vendor updated successfully',
    APPROVED: 'Vendor approved successfully',
    PENDING_APPROVAL: 'Vendor profile submitted and pending admin approval',
  },

  // Farm
  FARM: {
    CREATED: 'Farm created successfully',
    FETCHED: 'Farm fetched successfully',
    LIST_FETCHED: 'Farms fetched successfully',
    UPDATED: 'Farm updated successfully',
    DELETED: 'Farm deleted successfully',
  },

  // Garden Space
  GARDEN_SPACE: {
    CREATED: 'Garden space created successfully',
    FETCHED: 'Garden space fetched successfully',
    LIST_FETCHED: 'Garden spaces fetched successfully',
    UPDATED: 'Garden space updated successfully',
    DELETED: 'Garden space deleted successfully',
  },

  // Booking
  BOOKING: {
    CREATED: 'Booking created successfully',
    FETCHED: 'Booking fetched successfully',
    LIST_FETCHED: 'Bookings fetched successfully',
    STATUS_UPDATED: 'Booking status updated successfully',
    CANCELLED: 'Booking cancelled successfully',
  },

  // Plant
  PLANT: {
    CREATED: 'Plant tracking initiated successfully',
    FETCHED: 'Plant fetched successfully',
    LIST_FETCHED: 'Plants fetched successfully',
    UPDATE_ADDED: 'Plant update added successfully',
  },

  // Product
  PRODUCT: {
    CREATED: 'Product created successfully',
    FETCHED: 'Product fetched successfully',
    LIST_FETCHED: 'Products fetched successfully',
    UPDATED: 'Product updated successfully',
    DELETED: 'Product deleted successfully',
  },

  // Cart
  CART: {
    ITEM_ADDED: 'Item added to cart',
    ITEM_REMOVED: 'Item removed from cart',
    ITEM_UPDATED: 'Cart item updated',
    FETCHED: 'Cart fetched successfully',
  },

  // Order
  ORDER: {
    CREATED: 'Order placed successfully',
    FETCHED: 'Order fetched successfully',
    LIST_FETCHED: 'Orders fetched successfully',
    STATUS_UPDATED: 'Order status updated successfully',
  },

  // Certification
  CERTIFICATION: {
    UPLOADED: 'Certification uploaded successfully and pending review',
    LIST_FETCHED: 'Certifications fetched successfully',
    APPROVED: 'Certification approved',
    REJECTED: 'Certification rejected',
  },

  // Forum
  FORUM: {
    POST_CREATED: 'Forum post created successfully',
    POST_FETCHED: 'Forum post fetched successfully',
    POSTS_FETCHED: 'Forum posts fetched successfully',
    COMMENT_ADDED: 'Comment added successfully',
  },

  // Review
  REVIEW: {
    CREATED: 'Review submitted successfully',
    LIST_FETCHED: 'Reviews fetched successfully',
  },
} as const;
