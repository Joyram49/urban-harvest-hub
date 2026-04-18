import { type ProductStatus, type Prisma } from '@prisma/client';

import { logger } from '@/config/logger';
import { prisma } from '@/config/prisma';
import { BadRequestError, ForbiddenError, NotFoundError } from '@/errors/AppError';
import {
  type CreateCategoryInput,
  type CreateProductInput,
  type GetProductsQuery,
  type IProduct,
  type IProductCategory,
  type UpdateCategoryInput,
  type UpdateProductInput,
  type UpdateStockInput,
} from '@/modules/products/product.types';
import { getPaginationOptions } from '@/utils/pagination';
import { buildMeta } from '@/utils/response.util';

import type { Request } from 'express';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Convert product name to URL-safe slug, appending a short unique suffix */
function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${base}-${suffix}`;
}

/** Prisma select shape for a full product response */
const productSelect = {
  id: true,
  vendorId: true,
  categoryId: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  comparePrice: true,
  stock: true,
  lowStockAt: true,
  unit: true,
  imageUrl: true,
  images: true,
  isCertified: true,
  isOrganic: true,
  status: true,
  avgRating: true,
  totalReviews: true,
  totalSold: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: { id: true, name: true, slug: true },
  },
  vendor: {
    select: { id: true, businessName: true, logoUrl: true, avgRating: true },
  },
} as const;

/** Prisma select shape for a category */
const categorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  imageUrl: true,
  isActive: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;

// ─── Category Services ────────────────────────────────────────────────────────

export async function createCategory(input: CreateCategoryInput): Promise<IProductCategory> {
  const slug = input.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-');

  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) {
    throw new BadRequestError(`A category with the name "${input.name}" already exists`);
  }

  const category = await prisma.category.create({
    data: {
      name: input.name,
      slug,
      description: input.description,
      imageUrl: input.imageUrl,
      sortOrder: input.sortOrder,
    },
    select: categorySelect,
  });

  logger.info(`Category created: ${category.name}`);
  return category;
}

export async function getAllCategories(): Promise<IProductCategory[]> {
  return prisma.category.findMany({
    where: { isActive: true },
    select: categorySelect,
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });
}

export async function getCategoryById(categoryId: string): Promise<IProductCategory> {
  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: categorySelect,
  });
  if (!category) throw new NotFoundError('Category not found');
  return category;
}

export async function updateCategory(
  categoryId: string,
  input: UpdateCategoryInput,
): Promise<IProductCategory> {
  const category = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!category) throw new NotFoundError('Category not found');

  // If renaming, check slug uniqueness
  let slug: string | undefined;
  if (input.name !== undefined) {
    slug = input.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-');
    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing && existing.id !== categoryId) {
      throw new BadRequestError(`A category with the name "${input.name}" already exists`);
    }
  }

  const updated = await prisma.category.update({
    where: { id: categoryId },
    data: {
      ...(input.name !== undefined && { name: input.name, slug }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
    select: categorySelect,
  });

  logger.info(`Category updated: ${updated.name}`);
  return updated;
}

// ─── Product Services ─────────────────────────────────────────────────────────

export async function createProduct(
  vendorId: string,
  input: CreateProductInput,
): Promise<IProduct> {
  // Verify vendor exists and is approved
  const vendor = await prisma.vendor.findUnique({ where: { userId: vendorId } });
  if (!vendor)
    throw new NotFoundError('Vendor profile not found. Please create a vendor profile first.');
  if (vendor.status !== 'APPROVED') {
    throw new ForbiddenError('Your vendor account must be approved before listing products');
  }

  // Verify category exists and is active
  const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
  if (!category?.isActive) throw new NotFoundError('Category not found or inactive');

  const slug = generateSlug(input.name);

  const product = await prisma.product.create({
    data: {
      vendorId: vendor.id,
      categoryId: input.categoryId,
      name: input.name,
      slug,
      description: input.description,
      price: input.price,
      comparePrice: input.comparePrice,
      stock: input.stock,
      lowStockAt: input.lowStockAt,
      unit: input.unit,
      imageUrl: input.imageUrl,
      images: input.images ?? [],
      isOrganic: input.isOrganic,
      // isCertified is set automatically when vendor cert is approved
      status: input.stock === 0 ? 'OUT_OF_STOCK' : 'ACTIVE',
    },
    select: productSelect,
  });

  logger.info(`Product created: "${product.name}" by vendor ${vendor.id}`);
  return product as IProduct;
}

export async function getProducts(
  req: Request,
  query: GetProductsQuery,
): Promise<{
  products: IProduct[];
  meta: ReturnType<typeof buildMeta>;
}> {
  const { page, limit, skip } = getPaginationOptions(req);
  const {
    categoryId,
    vendorId,
    status,
    isOrganic,
    isCertified,
    minPrice,
    maxPrice,
    search,
    sortBy,
    sortOrder,
  } = query;

  const where: Prisma.ProductWhereInput = {
    ...(categoryId && { categoryId }),
    ...(vendorId && { vendor: { id: vendorId } }),
    ...(status ? { status } : { status: { not: 'ARCHIVED' as ProductStatus } }),
    ...(isOrganic !== undefined && { isOrganic }),
    ...(isCertified !== undefined && { isCertified }),
    ...((minPrice ?? maxPrice) && {
      price: {
        ...(minPrice !== undefined && { gte: minPrice }),
        ...(maxPrice !== undefined && { lte: maxPrice }),
      },
    }),
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
  };

  const orderBy: Prisma.ProductOrderByWithRelationInput = { [sortBy]: sortOrder };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      select: productSelect,
      orderBy,
      skip,
      take: limit,
    }),
  ]);

  return { products: products as IProduct[], meta: buildMeta(total, page, limit) };
}

export async function getProductById(productId: string): Promise<IProduct> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: productSelect,
  });
  if (!product || product.status === 'ARCHIVED') throw new NotFoundError('Product not found');
  return product as IProduct;
}

export async function getProductBySlug(slug: string): Promise<IProduct> {
  const product = await prisma.product.findUnique({
    where: { slug },
    select: productSelect,
  });
  if (!product || product.status === 'ARCHIVED') throw new NotFoundError('Product not found');
  return product as IProduct;
}

// eslint-disable-next-line complexity
export async function updateProduct(
  userId: string,
  productId: string,
  input: UpdateProductInput,
): Promise<IProduct> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { vendor: { select: { userId: true, id: true } } },
  });

  if (!product || product.status === 'ARCHIVED') throw new NotFoundError('Product not found');

  if (product.vendor.userId !== userId) {
    throw new ForbiddenError('You do not have permission to update this product');
  }

  if (input.categoryId) {
    const category = await prisma.category.findUnique({ where: { id: input.categoryId } });
    if (!category?.isActive) throw new NotFoundError('Category not found or inactive');
  }

  // Determine auto-status based on stock if stock is being updated
  let resolvedStatus = input.status;
  if (input.stock !== undefined && input.status === undefined) {
    resolvedStatus = input.stock === 0 ? 'OUT_OF_STOCK' : 'ACTIVE';
  }

  const updated = await prisma.product.update({
    where: { id: productId },
    data: {
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.name !== undefined && { name: input.name, slug: generateSlug(input.name) }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.price !== undefined && { price: input.price }),
      ...(input.comparePrice !== undefined && { comparePrice: input.comparePrice }),
      ...(input.stock !== undefined && { stock: input.stock }),
      ...(input.lowStockAt !== undefined && { lowStockAt: input.lowStockAt }),
      ...(input.unit !== undefined && { unit: input.unit }),
      ...(input.imageUrl !== undefined && { imageUrl: input.imageUrl }),
      ...(input.images !== undefined && { images: input.images }),
      ...(input.isOrganic !== undefined && { isOrganic: input.isOrganic }),
      ...(resolvedStatus !== undefined && { status: resolvedStatus }),
    },
    select: productSelect,
  });

  logger.info(`Product updated: "${updated.name}" (${productId})`);
  return updated as IProduct;
}

export async function updateProductStock(
  userId: string,
  productId: string,
  input: UpdateStockInput,
): Promise<IProduct> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { vendor: { select: { userId: true } } },
  });

  if (!product || product.status === 'ARCHIVED') throw new NotFoundError('Product not found');

  if (product.vendor.userId !== userId) {
    throw new ForbiddenError('You do not have permission to update this product');
  }

  const newStatus = input.stock === 0 ? 'OUT_OF_STOCK' : 'ACTIVE';

  const updated = await prisma.product.update({
    where: { id: productId },
    data: { stock: input.stock, status: newStatus },
    select: productSelect,
  });

  logger.info(`Product stock updated: "${updated.name}" → ${input.stock}`);
  return updated as IProduct;
}

export async function deleteProduct(userId: string, productId: string): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { vendor: { select: { userId: true } } },
  });

  if (!product || product.status === 'ARCHIVED') throw new NotFoundError('Product not found');

  if (product.vendor.userId !== userId) {
    throw new ForbiddenError('You do not have permission to delete this product');
  }

  // Soft delete — archive instead of hard delete to preserve order history
  await prisma.product.update({
    where: { id: productId },
    data: { status: 'ARCHIVED' },
  });

  logger.info(`Product archived (soft-deleted): "${product.name}" (${productId})`);
}

export async function getMyProducts(
  req: Request,
  userId: string,
  query: GetProductsQuery,
): Promise<{
  products: IProduct[];
  meta: ReturnType<typeof buildMeta>;
}> {
  const vendor = await prisma.vendor.findUnique({ where: { userId } });
  if (!vendor) throw new NotFoundError('Vendor profile not found');

  return getProducts(req, { ...query, vendorId: vendor.id });
}
