import { logger } from '@/config/logger';
import { prisma } from '@/config/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/errors/AppError';
import type {
  AddToCartInput,
  ICart,
  ICartSummary,
  UpdateCartItemInput,
} from '@/modules/cart/cart.types';

// ─── Selectors ────────────────────────────────────────────────────────────────

const cartItemSelect = {
  id: true,
  cartId: true,
  productId: true,
  quantity: true,
  createdAt: true,
  updatedAt: true,
  product: {
    select: {
      id: true,
      name: true,
      slug: true,
      price: true,
      comparePrice: true,
      imageUrl: true,
      stock: true,
      unit: true,
      status: true,
      isOrganic: true,
      isCertified: true,
      vendor: {
        select: { id: true, businessName: true },
      },
    },
  },
} as const;

const cartSelect = {
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
  items: {
    select: cartItemSelect,
    orderBy: { createdAt: 'asc' as const },
  },
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Calculate cart summary totals from cart items */
function computeSummary(
  items: Array<{
    quantity: number;
    product: { price: unknown; stock: number; status: string };
  }>,
): ICartSummary {
  let totalQuantity = 0;
  let subtotal = 0;
  let unavailableItems = 0;

  for (const item of items) {
    totalQuantity += item.quantity;
    const isAvailable = item.product.status === 'ACTIVE' && item.product.stock > 0;
    if (isAvailable) {
      subtotal += parseFloat(String(item.product.price)) * item.quantity;
    } else {
      unavailableItems++;
    }
  }

  return {
    itemCount: items.length,
    totalQuantity,
    subtotal: Math.round(subtotal * 100) / 100,
    unavailableItems,
  };
}

/** Find or create cart for user */
async function findOrCreateCart(userId: string): Promise<{ id: string }> {
  const existing = await prisma.cart.findUnique({ where: { userId } });
  if (existing) return existing;

  return prisma.cart.create({ data: { userId } });
}

// ─── Get Cart ─────────────────────────────────────────────────────────────────

export async function getCart(userId: string): Promise<ICart> {
  // Auto-create cart if it doesn't exist yet
  const cart = await prisma.cart.findUnique({
    where: { userId },
    select: cartSelect,
  });

  if (!cart) {
    const newCart = await prisma.cart.create({
      data: { userId },
      select: cartSelect,
    });
    return { ...newCart, summary: computeSummary([]) } as ICart;
  }

  const summary = computeSummary(cart.items);
  return { ...cart, summary } as ICart;
}

// ─── Add To Cart ──────────────────────────────────────────────────────────────

export async function addToCart(userId: string, input: AddToCartInput): Promise<ICart> {
  const cart = await findOrCreateCart(userId);

  // Validate product exists and is purchasable
  const product = await prisma.product.findUnique({
    where: { id: input.productId },
    select: { id: true, name: true, stock: true, status: true },
  });

  if (!product || product.status === 'ARCHIVED') {
    throw new NotFoundError('Product not found');
  }

  if (product.status === 'OUT_OF_STOCK' || product.stock === 0) {
    throw new BadRequestError(`"${product.name}" is currently out of stock`);
  }

  // Check if item already in cart — if so, increment quantity
  const existingItem = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId: input.productId } },
  });

  const newQuantity = (existingItem?.quantity ?? 0) + input.quantity;

  // Validate combined quantity against available stock
  if (newQuantity > product.stock) {
    throw new BadRequestError(
      `Only ${product.stock} unit(s) of "${product.name}" are available. You already have ${existingItem?.quantity ?? 0} in your cart.`,
    );
  }

  if (newQuantity > 100) {
    throw new BadRequestError('You cannot add more than 100 units of any single item');
  }

  if (existingItem) {
    await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: { quantity: newQuantity },
    });
  } else {
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId: input.productId, quantity: input.quantity },
    });
  }

  logger.info(`Cart updated: user ${userId} — added ${input.quantity}× "${product.name}"`);
  return getCart(userId);
}

// ─── Update Cart Item ─────────────────────────────────────────────────────────

export async function updateCartItem(
  userId: string,
  itemId: string,
  input: UpdateCartItemInput,
): Promise<ICart> {
  // Verify item belongs to this user's cart
  const item = await prisma.cartItem.findUnique({
    where: { id: itemId },
    include: {
      cart: { select: { userId: true } },
      product: { select: { name: true, stock: true, status: true } },
    },
  });

  if (!item) throw new NotFoundError('Cart item not found');

  if (item.cart.userId !== userId) {
    throw new ForbiddenError('You do not have permission to modify this cart item');
  }

  if (item.product.status === 'ARCHIVED') {
    throw new BadRequestError('This product is no longer available');
  }

  if (input.quantity > item.product.stock) {
    throw new BadRequestError(
      `Only ${item.product.stock} unit(s) of "${item.product.name}" are available`,
    );
  }

  await prisma.cartItem.update({
    where: { id: itemId },
    data: { quantity: input.quantity },
  });

  logger.info(`Cart item updated: ${itemId} → qty ${input.quantity}`);
  return getCart(userId);
}

// ─── Remove Cart Item ─────────────────────────────────────────────────────────

export async function removeCartItem(userId: string, itemId: string): Promise<ICart> {
  const item = await prisma.cartItem.findUnique({
    where: { id: itemId },
    include: { cart: { select: { userId: true } } },
  });

  if (!item) throw new NotFoundError('Cart item not found');

  if (item.cart.userId !== userId) {
    throw new ForbiddenError('You do not have permission to remove this cart item');
  }

  await prisma.cartItem.delete({ where: { id: itemId } });

  logger.info(`Cart item removed: ${itemId} by user ${userId}`);
  return getCart(userId);
}

// ─── Clear Cart ───────────────────────────────────────────────────────────────

export async function clearCart(userId: string): Promise<ICart> {
  const cart = await prisma.cart.findUnique({ where: { userId } });

  if (!cart) {
    // Nothing to clear — return empty cart
    return getCart(userId);
  }

  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });

  logger.info(`Cart cleared for user ${userId}`);
  return getCart(userId);
}
