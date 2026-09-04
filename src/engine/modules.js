/**
 * What a module actually *is*, so that ticking one produces both its endpoints
 * and its tables. This is the chain that makes the planner worth using:
 * modules -> APIs -> DBML.
 *
 * Field shape: { name, type, pk, ref, notNull, unique }
 *   `ref` is a soft "table.column" marker; DBML generation turns it into a
 *   `Ref:` line, and a ref whose table is not selected is dropped rather than
 *   emitting a relationship to a table that does not exist.
 *
 * Table names are unique across the whole catalogue. Two modules that both
 * wanted a `categories` table would collide the moment someone picked both on
 * a custom plan, so the marketplace side uses its own vocabulary throughout.
 */

const ID = { name: 'id', type: 'integer', pk: true, increment: true };
const CREATED = { name: 'created_at', type: 'timestamp' };

export const MODULES = [
  {
    key: 'auth',
    complexity: 'medium',
    name: 'Authentication',
    summary: 'Accounts, sessions and roles.',
    presets: ['ecommerce', 'saas', 'blog', 'marketplace'],
    dependsOn: [],
    blueprintKey: 'auth',
    entities: [
      {
        name: 'users',
        fields: [
          ID,
          { name: 'username', type: 'varchar', notNull: true, unique: true },
          { name: 'email', type: 'varchar', notNull: true, unique: true },
          { name: 'password_hash', type: 'varchar', notNull: true },
          CREATED,
        ],
      },
      {
        name: 'roles',
        fields: [ID, { name: 'name', type: 'varchar', notNull: true, unique: true }],
      },
      {
        name: 'user_roles',
        fields: [
          ID,
          { name: 'user_id', type: 'integer', notNull: true, ref: 'users.id' },
          { name: 'role_id', type: 'integer', notNull: true, ref: 'roles.id' },
        ],
      },
    ],
    apis: [
      { method: 'POST', path: '/api/auth/register', purpose: 'Create an account', auth: false },
      { method: 'POST', path: '/api/auth/login', purpose: 'Start a session', auth: false },
      { method: 'POST', path: '/api/auth/logout', purpose: 'End the session', auth: true },
      { method: 'GET', path: '/api/auth/me', purpose: 'Who am I', auth: true },
    ],
  },

  // ------------------------------------------------------------- ecommerce
  {
    key: 'catalog',
    complexity: 'medium',
    name: 'Product catalog',
    summary: 'Products, categories and images.',
    presets: ['ecommerce'],
    dependsOn: [],
    blueprintKey: 'generic-crud',
    entities: [
      {
        name: 'products',
        fields: [
          ID,
          { name: 'name', type: 'varchar', notNull: true },
          { name: 'slug', type: 'varchar', notNull: true, unique: true },
          { name: 'description', type: 'text' },
          { name: 'price', type: 'decimal(10,2)', notNull: true },
          { name: 'active', type: 'boolean' },
          CREATED,
        ],
      },
      {
        name: 'categories',
        fields: [
          ID,
          { name: 'name', type: 'varchar', notNull: true },
          { name: 'slug', type: 'varchar', notNull: true, unique: true },
          { name: 'parent_id', type: 'integer', ref: 'categories.id' },
        ],
      },
      {
        name: 'product_categories',
        fields: [
          ID,
          { name: 'product_id', type: 'integer', notNull: true, ref: 'products.id' },
          { name: 'category_id', type: 'integer', notNull: true, ref: 'categories.id' },
        ],
      },
      {
        name: 'product_images',
        fields: [
          ID,
          { name: 'product_id', type: 'integer', notNull: true, ref: 'products.id' },
          { name: 'url', type: 'varchar', notNull: true },
          { name: 'position', type: 'integer' },
        ],
      },
    ],
    apis: [
      { method: 'GET', path: '/api/products', purpose: 'Browse products', auth: false },
      { method: 'GET', path: '/api/products/:id', purpose: 'One product', auth: false },
      { method: 'POST', path: '/api/products', purpose: 'Add a product', auth: true },
      { method: 'PUT', path: '/api/products/:id', purpose: 'Edit a product', auth: true },
      { method: 'DELETE', path: '/api/products/:id', purpose: 'Remove a product', auth: true },
      { method: 'GET', path: '/api/categories', purpose: 'Category tree', auth: false },
    ],
  },
  {
    key: 'inventory',
    complexity: 'small',
    name: 'Inventory',
    summary: 'Stock levels and the movements behind them.',
    presets: ['ecommerce'],
    dependsOn: ['catalog'],
    blueprintKey: 'generic-crud',
    entities: [
      {
        name: 'stock_levels',
        fields: [
          ID,
          { name: 'product_id', type: 'integer', notNull: true, ref: 'products.id' },
          { name: 'quantity', type: 'integer', notNull: true },
          { name: 'reserved', type: 'integer' },
        ],
      },
      {
        name: 'stock_movements',
        fields: [
          ID,
          { name: 'product_id', type: 'integer', notNull: true, ref: 'products.id' },
          { name: 'delta', type: 'integer', notNull: true },
          { name: 'reason', type: 'varchar' },
          CREATED,
        ],
      },
    ],
    apis: [
      { method: 'GET', path: '/api/inventory/:productId', purpose: 'Stock for a product', auth: true },
      { method: 'POST', path: '/api/inventory/adjust', purpose: 'Adjust stock', auth: true },
    ],
  },
  {
    key: 'cart',
    complexity: 'small',
    name: 'Cart',
    summary: 'A basket per customer.',
    presets: ['ecommerce'],
    dependsOn: ['auth', 'catalog'],
    blueprintKey: 'generic-crud',
    entities: [
      {
        name: 'carts',
        fields: [ID, { name: 'user_id', type: 'integer', notNull: true, ref: 'users.id' }, CREATED],
      },
      {
        name: 'cart_items',
        fields: [
          ID,
          { name: 'cart_id', type: 'integer', notNull: true, ref: 'carts.id' },
          { name: 'product_id', type: 'integer', notNull: true, ref: 'products.id' },
          { name: 'quantity', type: 'integer', notNull: true },
        ],
      },
    ],
    apis: [
      { method: 'GET', path: '/api/cart', purpose: 'Current cart', auth: true },
      { method: 'POST', path: '/api/cart/items', purpose: 'Add an item', auth: true },
      { method: 'PATCH', path: '/api/cart/items/:id', purpose: 'Change quantity', auth: true },
      { method: 'DELETE', path: '/api/cart/items/:id', purpose: 'Remove an item', auth: true },
    ],
  },
  {
    key: 'orders',
    complexity: 'medium',
    name: 'Orders',
    summary: 'Placed orders and their lines.',
    presets: ['ecommerce'],
    dependsOn: ['auth', 'catalog'],
    blueprintKey: 'generic-crud',
    entities: [
      {
        name: 'orders',
        fields: [
          ID,
          { name: 'user_id', type: 'integer', notNull: true, ref: 'users.id' },
          { name: 'status', type: 'varchar', notNull: true },
          { name: 'total', type: 'decimal(10,2)', notNull: true },
          { name: 'placed_at', type: 'timestamp' },
        ],
      },
      {
        name: 'order_items',
        fields: [
          ID,
          { name: 'order_id', type: 'integer', notNull: true, ref: 'orders.id' },
          { name: 'product_id', type: 'integer', ref: 'products.id' },
          { name: 'title', type: 'varchar', notNull: true },
          { name: 'unit_price', type: 'decimal(10,2)', notNull: true },
          { name: 'quantity', type: 'integer', notNull: true },
        ],
      },
    ],
    apis: [
      { method: 'GET', path: '/api/orders', purpose: 'My orders', auth: true },
      { method: 'GET', path: '/api/orders/:id', purpose: 'One order', auth: true },
      { method: 'POST', path: '/api/orders', purpose: 'Place an order', auth: true },
      { method: 'PATCH', path: '/api/orders/:id/status', purpose: 'Move it along', auth: true },
    ],
  },
  {
    key: 'checkout',
    complexity: 'large',
    name: 'Checkout and payments',
    summary: 'Taking money, and the record that it happened.',
    presets: ['ecommerce'],
    dependsOn: ['cart', 'orders'],
    blueprintKey: 'generic-crud',
    entities: [
      {
        name: 'payments',
        fields: [
          ID,
          { name: 'order_id', type: 'integer', notNull: true, ref: 'orders.id' },
          { name: 'provider', type: 'varchar', notNull: true },
          { name: 'provider_ref', type: 'varchar' },
          { name: 'amount', type: 'decimal(10,2)', notNull: true },
          { name: 'status', type: 'varchar', notNull: true },
          CREATED,
        ],
      },
    ],
    apis: [
      { method: 'POST', path: '/api/checkout/session', purpose: 'Start a payment', auth: true },
      { method: 'POST', path: '/api/checkout/webhook', purpose: 'Provider callback', auth: false },
      { method: 'GET', path: '/api/checkout/:id', purpose: 'Payment status', auth: true },
    ],
  },
  {
    key: 'reviews',
    complexity: 'small',
    name: 'Product reviews',
    summary: 'Ratings and written reviews on products.',
    presets: ['ecommerce'],
    dependsOn: ['auth', 'catalog'],
    blueprintKey: 'generic-crud',
    entities: [
      {
        name: 'reviews',
        fields: [
          ID,
          { name: 'user_id', type: 'integer', notNull: true, ref: 'users.id' },
          { name: 'product_id', type: 'integer', notNull: true, ref: 'products.id' },
          { name: 'rating', type: 'integer', notNull: true },
          { name: 'body', type: 'text' },
          CREATED,
        ],
      },
    ],
    apis: [
      { method: 'GET', path: '/api/products/:id/reviews', purpose: 'Reviews for a product', auth: false },
      { method: 'POST', path: '/api/products/:id/reviews', purpose: 'Write a review', auth: true },
      { method: 'DELETE', path: '/api/reviews/:id', purpose: 'Remove a review', auth: true },
    ],
  },

  // ------------------------------------------------------------------ saas
  {
    key: 'teams',
    complexity: 'medium',
    name: 'Teams',
    summary: 'Workspaces and who belongs to them.',
    presets: ['saas'],
    dependsOn: ['auth'],
    blueprintKey: 'generic-crud',
    entities: [
      {
        name: 'teams',
        fields: [
          ID,
          { name: 'name', type: 'varchar', notNull: true },
          { name: 'owner_id', type: 'integer', notNull: true, ref: 'users.id' },
          CREATED,
        ],
      },
      {
        name: 'team_members',
        fields: [
          ID,
          { name: 'team_id', type: 'integer', notNull: true, ref: 'teams.id' },
          { name: 'user_id', type: 'integer', notNull: true, ref: 'users.id' },
          { name: 'role', type: 'varchar', notNull: true },
        ],
      },
    ],
    apis: [
      { method: 'GET', path: '/api/teams', purpose: 'My teams', auth: true },
      { method: 'POST', path: '/api/teams', purpose: 'Create a team', auth: true },
      { method: 'POST', path: '/api/teams/:id/members', purpose: 'Invite someone', auth: true },
      { method: 'DELETE', path: '/api/teams/:id/members/:userId', purpose: 'Remove someone', auth: true },
    ],
  },
  {
    key: 'permissions',
    complexity: 'medium',
    name: 'Permissions',
    summary: 'What each role is allowed to do.',
    presets: ['saas'],
    dependsOn: ['auth'],
    blueprintKey: 'auth',
    entities: [
      {
        name: 'permissions',
        fields: [
          ID,
          { name: 'key', type: 'varchar', notNull: true, unique: true },
          { name: 'description', type: 'varchar' },
        ],
      },
      {
        name: 'role_permissions',
        fields: [
          ID,
          { name: 'role_id', type: 'integer', notNull: true, ref: 'roles.id' },
          { name: 'permission_id', type: 'integer', notNull: true, ref: 'permissions.id' },
        ],
      },
    ],
    apis: [
      { method: 'GET', path: '/api/permissions', purpose: 'Everything grantable', auth: true },
      { method: 'PUT', path: '/api/roles/:id/permissions', purpose: 'Set a role’s permissions', auth: true },
    ],
  },
  {
    key: 'billing',
    complexity: 'large',
    name: 'Billing',
    summary: 'Subscriptions and invoices.',
    presets: ['saas'],
    dependsOn: ['auth'],
    blueprintKey: 'generic-crud',
    entities: [
      {
        name: 'subscriptions',
        fields: [
          ID,
          { name: 'user_id', type: 'integer', notNull: true, ref: 'users.id' },
          { name: 'plan', type: 'varchar', notNull: true },
          { name: 'status', type: 'varchar', notNull: true },
          { name: 'current_period_end', type: 'timestamp' },
        ],
      },
      {
        name: 'invoices',
        fields: [
          ID,
          { name: 'subscription_id', type: 'integer', notNull: true, ref: 'subscriptions.id' },
          { name: 'amount', type: 'decimal(10,2)', notNull: true },
          { name: 'paid_at', type: 'timestamp' },
        ],
      },
    ],
    apis: [
      { method: 'GET', path: '/api/billing/subscription', purpose: 'Current subscription', auth: true },
      { method: 'POST', path: '/api/billing/subscribe', purpose: 'Start or change a plan', auth: true },
      { method: 'POST', path: '/api/billing/webhook', purpose: 'Provider callback', auth: false },
      { method: 'GET', path: '/api/billing/invoices', purpose: 'Invoice history', auth: true },
    ],
  },

  // ------------------------------------------------------------------ blog
  {
    key: 'posts',
    complexity: 'small',
    name: 'Posts',
    summary: 'The writing itself.',
    presets: ['blog'],
    dependsOn: ['auth'],
    blueprintKey: 'generic-crud',
    entities: [
      {
        name: 'posts',
        fields: [
          ID,
          { name: 'author_id', type: 'integer', notNull: true, ref: 'users.id' },
          { name: 'title', type: 'varchar', notNull: true },
          { name: 'slug', type: 'varchar', notNull: true, unique: true },
          { name: 'body', type: 'text' },
          { name: 'published', type: 'boolean' },
          { name: 'published_at', type: 'timestamp' },
          CREATED,
        ],
      },
    ],
    apis: [
      { method: 'GET', path: '/api/posts', purpose: 'List posts', auth: false },
      { method: 'GET', path: '/api/posts/:slug', purpose: 'Read a post', auth: false },
      { method: 'POST', path: '/api/posts', purpose: 'Write a post', auth: true },
      { method: 'PUT', path: '/api/posts/:id', purpose: 'Edit a post', auth: true },
      { method: 'DELETE', path: '/api/posts/:id', purpose: 'Delete a post', auth: true },
    ],
  },
  {
    key: 'tags',
    complexity: 'trivial',
    name: 'Tags',
    summary: 'How posts are grouped.',
    presets: ['blog'],
    dependsOn: ['posts'],
    blueprintKey: 'generic-crud',
    entities: [
      {
        name: 'tags',
        fields: [
          ID,
          { name: 'name', type: 'varchar', notNull: true, unique: true },
          { name: 'slug', type: 'varchar', notNull: true, unique: true },
        ],
      },
      {
        name: 'post_tags',
        fields: [
          ID,
          { name: 'post_id', type: 'integer', notNull: true, ref: 'posts.id' },
          { name: 'tag_id', type: 'integer', notNull: true, ref: 'tags.id' },
        ],
      },
    ],
    apis: [
      { method: 'GET', path: '/api/tags', purpose: 'All tags', auth: false },
      { method: 'GET', path: '/api/tags/:slug/posts', purpose: 'Posts under a tag', auth: false },
    ],
  },
  {
    key: 'comments',
    complexity: 'small',
    name: 'Comments',
    summary: 'Replies on posts, with moderation.',
    presets: ['blog'],
    dependsOn: ['auth', 'posts'],
    blueprintKey: 'generic-crud',
    entities: [
      {
        name: 'comments',
        fields: [
          ID,
          { name: 'post_id', type: 'integer', notNull: true, ref: 'posts.id' },
          { name: 'user_id', type: 'integer', notNull: true, ref: 'users.id' },
          { name: 'body', type: 'text', notNull: true },
          { name: 'approved', type: 'boolean' },
          CREATED,
        ],
      },
    ],
    apis: [
      { method: 'GET', path: '/api/posts/:id/comments', purpose: 'Comments on a post', auth: false },
      { method: 'POST', path: '/api/posts/:id/comments', purpose: 'Leave a comment', auth: true },
      { method: 'DELETE', path: '/api/comments/:id', purpose: 'Remove a comment', auth: true },
    ],
  },
  {
    key: 'media',
    complexity: 'medium',
    name: 'Media',
    summary: 'Uploaded images and files.',
    presets: ['blog'],
    dependsOn: ['auth'],
    blueprintKey: 'generic-crud',
    entities: [
      {
        name: 'media_assets',
        fields: [
          ID,
          { name: 'uploader_id', type: 'integer', notNull: true, ref: 'users.id' },
          { name: 'url', type: 'varchar', notNull: true },
          { name: 'mime', type: 'varchar' },
          { name: 'size_bytes', type: 'integer' },
          CREATED,
        ],
      },
    ],
    apis: [
      { method: 'GET', path: '/api/media', purpose: 'Uploaded files', auth: true },
      { method: 'POST', path: '/api/media', purpose: 'Upload a file', auth: true },
      { method: 'DELETE', path: '/api/media/:id', purpose: 'Delete a file', auth: true },
    ],
  },

  // ----------------------------------------------------------- marketplace
  {
    key: 'listings',
    complexity: 'medium',
    name: 'Listings',
    summary: 'What sellers put up for sale.',
    presets: ['marketplace'],
    dependsOn: ['auth'],
    blueprintKey: 'generic-crud',
    entities: [
      {
        name: 'listings',
        fields: [
          ID,
          { name: 'seller_id', type: 'integer', notNull: true, ref: 'users.id' },
          { name: 'title', type: 'varchar', notNull: true },
          { name: 'description', type: 'text' },
          { name: 'price', type: 'decimal(10,2)', notNull: true },
          { name: 'status', type: 'varchar', notNull: true },
          CREATED,
        ],
      },
      {
        name: 'listing_images',
        fields: [
          ID,
          { name: 'listing_id', type: 'integer', notNull: true, ref: 'listings.id' },
          { name: 'url', type: 'varchar', notNull: true },
          { name: 'position', type: 'integer' },
        ],
      },
    ],
    apis: [
      { method: 'GET', path: '/api/listings', purpose: 'Browse listings', auth: false },
      { method: 'GET', path: '/api/listings/:id', purpose: 'One listing', auth: false },
      { method: 'POST', path: '/api/listings', purpose: 'Create a listing', auth: true },
      { method: 'PUT', path: '/api/listings/:id', purpose: 'Edit a listing', auth: true },
      { method: 'DELETE', path: '/api/listings/:id', purpose: 'Take it down', auth: true },
    ],
  },
  {
    key: 'sales',
    complexity: 'large',
    name: 'Sales',
    summary: 'A buyer taking a listing, and the money attached.',
    presets: ['marketplace'],
    dependsOn: ['auth', 'listings'],
    blueprintKey: 'generic-crud',
    entities: [
      {
        name: 'sales',
        fields: [
          ID,
          { name: 'buyer_id', type: 'integer', notNull: true, ref: 'users.id' },
          { name: 'listing_id', type: 'integer', notNull: true, ref: 'listings.id' },
          { name: 'amount', type: 'decimal(10,2)', notNull: true },
          { name: 'status', type: 'varchar', notNull: true },
          CREATED,
        ],
      },
    ],
    apis: [
      { method: 'GET', path: '/api/sales', purpose: 'My purchases and sales', auth: true },
      { method: 'POST', path: '/api/sales', purpose: 'Buy a listing', auth: true },
      { method: 'PATCH', path: '/api/sales/:id/status', purpose: 'Move it along', auth: true },
    ],
  },
  {
    key: 'payouts',
    complexity: 'large',
    name: 'Payouts',
    summary: 'Getting sellers their money.',
    presets: ['marketplace'],
    dependsOn: ['auth', 'sales'],
    blueprintKey: 'generic-crud',
    entities: [
      {
        name: 'payouts',
        fields: [
          ID,
          { name: 'seller_id', type: 'integer', notNull: true, ref: 'users.id' },
          { name: 'amount', type: 'decimal(10,2)', notNull: true },
          { name: 'status', type: 'varchar', notNull: true },
          { name: 'paid_at', type: 'timestamp' },
        ],
      },
      {
        name: 'payout_items',
        fields: [
          ID,
          { name: 'payout_id', type: 'integer', notNull: true, ref: 'payouts.id' },
          { name: 'sale_id', type: 'integer', notNull: true, ref: 'sales.id' },
          { name: 'amount', type: 'decimal(10,2)', notNull: true },
        ],
      },
    ],
    apis: [
      { method: 'GET', path: '/api/payouts', purpose: 'Payout history', auth: true },
      { method: 'POST', path: '/api/payouts/:id/release', purpose: 'Release a payout', auth: true },
    ],
  },
  {
    key: 'messaging',
    complexity: 'large',
    name: 'Messaging',
    summary: 'Buyers and sellers talking to each other.',
    presets: ['marketplace'],
    dependsOn: ['auth', 'listings'],
    blueprintKey: 'generic-crud',
    entities: [
      {
        name: 'conversations',
        fields: [
          ID,
          { name: 'buyer_id', type: 'integer', notNull: true, ref: 'users.id' },
          { name: 'seller_id', type: 'integer', notNull: true, ref: 'users.id' },
          { name: 'listing_id', type: 'integer', ref: 'listings.id' },
          CREATED,
        ],
      },
      {
        name: 'messages',
        fields: [
          ID,
          { name: 'conversation_id', type: 'integer', notNull: true, ref: 'conversations.id' },
          { name: 'sender_id', type: 'integer', notNull: true, ref: 'users.id' },
          { name: 'body', type: 'text', notNull: true },
          CREATED,
        ],
      },
    ],
    apis: [
      { method: 'GET', path: '/api/conversations', purpose: 'My conversations', auth: true },
      { method: 'GET', path: '/api/conversations/:id/messages', purpose: 'Read a thread', auth: true },
      { method: 'POST', path: '/api/conversations/:id/messages', purpose: 'Send a message', auth: true },
    ],
  },
  {
    key: 'ratings',
    complexity: 'small',
    name: 'Seller ratings',
    summary: 'Buyers rating sellers after a sale.',
    presets: ['marketplace'],
    dependsOn: ['auth', 'sales'],
    blueprintKey: 'generic-crud',
    entities: [
      {
        name: 'ratings',
        fields: [
          ID,
          { name: 'rater_id', type: 'integer', notNull: true, ref: 'users.id' },
          { name: 'seller_id', type: 'integer', notNull: true, ref: 'users.id' },
          { name: 'sale_id', type: 'integer', notNull: true, ref: 'sales.id' },
          { name: 'score', type: 'integer', notNull: true },
          { name: 'body', type: 'text' },
          CREATED,
        ],
      },
    ],
    apis: [
      { method: 'GET', path: '/api/sellers/:id/ratings', purpose: 'A seller’s record', auth: false },
      { method: 'POST', path: '/api/sales/:id/rating', purpose: 'Rate the seller', auth: true },
    ],
  },

  // --------------------------------------------------------------- shared
  {
    key: 'search',
    complexity: 'large',
    name: 'Search',
    summary: 'Querying whatever your main content is.',
    presets: ['ecommerce', 'blog', 'marketplace'],
    dependsOn: [],
    blueprintKey: null,
    // No tables of its own: an index is not a table, and which content it
    // covers depends on the modules around it.
    entities: [],
    apis: [
      { method: 'GET', path: '/api/search', purpose: 'Search everything', auth: false },
      { method: 'GET', path: '/api/search/suggest', purpose: 'Typeahead suggestions', auth: false },
    ],
  },
  {
    key: 'notifications',
    complexity: 'medium',
    name: 'Notifications',
    summary: 'Telling people something happened.',
    presets: ['ecommerce', 'saas', 'marketplace'],
    dependsOn: ['auth'],
    blueprintKey: 'generic-crud',
    entities: [
      {
        name: 'notifications',
        fields: [
          ID,
          { name: 'user_id', type: 'integer', notNull: true, ref: 'users.id' },
          { name: 'type', type: 'varchar', notNull: true },
          { name: 'payload', type: 'json' },
          { name: 'read_at', type: 'timestamp' },
          CREATED,
        ],
      },
    ],
    apis: [
      { method: 'GET', path: '/api/notifications', purpose: 'My notifications', auth: true },
      { method: 'PATCH', path: '/api/notifications/:id/read', purpose: 'Mark as read', auth: true },
    ],
  },
  {
    key: 'admin',
    complexity: 'medium',
    name: 'Admin',
    summary: 'Back-office views and an audit trail.',
    presets: ['ecommerce', 'saas', 'blog', 'marketplace'],
    dependsOn: ['auth'],
    blueprintKey: null,
    entities: [
      {
        name: 'audit_logs',
        fields: [
          ID,
          { name: 'user_id', type: 'integer', ref: 'users.id' },
          { name: 'action', type: 'varchar', notNull: true },
          { name: 'entity', type: 'varchar' },
          { name: 'entity_id', type: 'integer' },
          CREATED,
        ],
      },
    ],
    apis: [
      { method: 'GET', path: '/api/admin/stats', purpose: 'Overview numbers', auth: true },
      { method: 'GET', path: '/api/admin/audit-logs', purpose: 'Who did what', auth: true },
    ],
  },
];

export const MODULE_KEYS = MODULES.map((module) => module.key);

export function findModule(key) {
  return MODULES.find((module) => module.key === key) ?? null;
}

export function modulesForPreset(presetKey) {
  if (presetKey === 'custom') return [];
  return MODULES.filter((module) => module.presets.includes(presetKey));
}
