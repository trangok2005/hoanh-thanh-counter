/**
 * @file Cache prompt theo task + menu + categories.
 * Menu/categories không đổi runtime nên prompt chỉ build một lần.
 */

const promptCache = new WeakMap();

/**
 * Lấy prompt đã cache, build lần đầu nếu chưa có.
 * @param {{ buildPrompt: (menu: any[], categories: any[]) => string }} task
 * @param {any[]} menu
 * @param {any[]} categories
 * @returns {string}
 */
export function getCachedPrompt(task, menu, categories) {
  let menuCache = promptCache.get(task);
  if (!menuCache) {
    menuCache = new WeakMap();
    promptCache.set(task, menuCache);
  }

  let categoryCache = menuCache.get(menu);
  if (!categoryCache) {
    categoryCache = new WeakMap();
    menuCache.set(menu, categoryCache);
  }

  let prompt = categoryCache.get(categories);
  if (prompt === undefined) {
    prompt = task.buildPrompt(menu, categories);
    categoryCache.set(categories, prompt);
  }

  return prompt;
}
