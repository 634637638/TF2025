/**
 * 生成统一的型号比较 SQL。
 * 型号检索忽略大小写、半角/全角空格和连字符差异。
 */
const normalizedModelSql = column => (
  `LOWER(REPLACE(REPLACE(REPLACE(TRIM(${column}), ' ', ''), '　', ''), '-', ''))`
)

/** 配合 LIKE ... ESCAPE '!'，将商品编码中的通配符按实际字符匹配。 */
const escapeLikePattern = value => String(value).replace(/[!%_]/g, '!$&')

module.exports = {
  normalizedModelSql,
  escapeLikePattern
}
