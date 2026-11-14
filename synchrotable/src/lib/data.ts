import { DishItem, InventoryMap, InventoryThresholds } from './types';

export const INITIAL_INVENTORY: InventoryMap = {
  sourdoughSlices: 8,
  cheeseGrams: 900,
  patties: 20,
  coffeeBeansGrams: 1000,
  friesGrams: 1400,
  chocolateGrams: 600,
};

export const INVENTORY_THRESHOLDS: InventoryThresholds = {
  sourdoughSlices: 10,
  cheeseGrams: 200,
  patties: 5,
  coffeeBeansGrams: 300,
  friesGrams: 400,
  chocolateGrams: 150,
};

export const MENU_ITEMS: DishItem[] = [
  // 1. Hot Chocolate
  {
    id: 'hot-chocolate',
    name: 'Hot Chocolate',
    course: 'Dessert',
    price: 90,
    cookTimeSeconds: 12,
    ingredients: {
      chocolateGrams: 40,
    },
    description: 'Rich warm cocoa topped with whipped cream and chocolate shavings',
    imageUrl: '/food/top/hot-chocolate.png',
  },
  // 2. Tea
  {
    id: 'tea',
    name: 'Tea',
    course: 'Dessert',
    price: 30,
    cookTimeSeconds: 10,
    ingredients: {
      coffeeBeansGrams: 15,
    },
    description: 'Aromatic steeped spiced masala tea brewed fresh with milk and cardamom',
    imageUrl: '/food/top/tea.png',
  },
  // 3. Coffee
  {
    id: 'coffee',
    name: 'Coffee',
    course: 'Dessert',
    price: 60,
    cookTimeSeconds: 10,
    ingredients: {
      coffeeBeansGrams: 25,
    },
    description: 'Freshly brewed artisan roast with steamed milk and latte art',
    imageUrl: '/food/top/coffee.png',
  },
  // 4. Club Sandwich
  {
    id: 'club-sandwich',
    name: 'Club Sandwhich',
    course: 'Starter',
    price: 120,
    cookTimeSeconds: 18,
    ingredients: {
      sourdoughSlices: 3,
      cheeseGrams: 40,
    },
    description: 'Triple-decker toasted sandwich with fresh layers, cheese & chips',
    imageUrl: '/food/top/club-sandwich.png',
  },
  // 5. Smash Burger
  {
    id: 'smash-burger',
    name: 'Smash Burger',
    course: 'Main',
    price: 160,
    cookTimeSeconds: 25,
    ingredients: {
      sourdoughSlices: 2,
      patties: 2,
      cheeseGrams: 60,
    },
    description: 'Crispy-edged seared beef patties, melted cheddar, crisp lettuce & house sauce',
    imageUrl: '/food/top/smash-burger.png',
  },
  // 6. Alfredo Pasta
  {
    id: 'alfredo-pasta',
    name: 'Alfredo Pasta',
    course: 'Main',
    price: 180,
    cookTimeSeconds: 20,
    ingredients: {
      cheeseGrams: 70,
    },
    description: 'Fresh tagliatelle fettuccine tossed in rich creamy parmesan alfredo sauce',
    imageUrl: '/food/top/alfredo-pasta.png',
  },
  // 7. Pizza
  {
    id: 'pizza',
    name: 'Pizza',
    course: 'Main',
    price: 220,
    cookTimeSeconds: 28,
    ingredients: {
      sourdoughSlices: 2,
      cheeseGrams: 100,
    },
    description: 'Hand-stretched wood-fired crust with rich tomato sauce, melted cheese & bell peppers',
    imageUrl: '/food/top/pizza.png',
  },
  // 8. French Fries
  {
    id: 'french-fries',
    name: 'French Fries',
    course: 'Starter',
    price: 90,
    cookTimeSeconds: 15,
    ingredients: {
      friesGrams: 200,
    },
    description: 'Crisp golden salted fries served with house dipping sauce',
    imageUrl: '/food/top/french-fries.png',
  },
  // 9. Maggi
  {
    id: 'maggi',
    name: 'Maggi',
    course: 'Starter',
    price: 60,
    cookTimeSeconds: 12,
    ingredients: {
      cheeseGrams: 20,
    },
    description: 'Classic hot spiced masala noodles with fresh herbs & seasonings',
    imageUrl: '/food/top/maggi.png',
  },
  // 10. Brownie with ice cream
  {
    id: 'brownie-ice-cream',
    name: 'Brownie with ice cream',
    course: 'Dessert',
    price: 140,
    cookTimeSeconds: 15,
    ingredients: {
      chocolateGrams: 60,
    },
    description: 'Fudgy dark chocolate brownie topped with cool vanilla ice cream scoop',
    imageUrl: '/food/top/brownie-ice-cream.png',
  },
  // 11. Sundae
  {
    id: 'sundae',
    name: 'Sundae',
    course: 'Dessert',
    price: 110,
    cookTimeSeconds: 10,
    ingredients: {
      chocolateGrams: 30,
    },
    description: 'Strawberry layered sundae with smooth cream and fresh strawberries',
    imageUrl: '/food/top/sundae.png',
  },
  // 12. Choco Lava Cake
  {
    id: 'choco-lava-cake',
    name: 'Choco Lava Cake',
    course: 'Dessert',
    price: 120,
    cookTimeSeconds: 18,
    ingredients: {
      chocolateGrams: 70,
    },
    description: 'Warm molten chocolate centered cake with rich cocoa dusted crust',
    imageUrl: '/food/top/choco-lava-cake.png',
  },
];
