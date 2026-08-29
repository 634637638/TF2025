const test = require('node:test');
const assert = require('node:assert/strict');
const ApiResponse = require('../src/utils/response');

function responseDouble() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test('server errors never expose internal error details', () => {
  const res = responseDouble();
  ApiResponse.serverError(res, '查询失败', new Error('ER_PARSE_ERROR: SELECT secret FROM users'));

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.message, '服务器内部错误，请稍后重试');
  assert.equal('error' in res.body, false);
  assert.equal('stack' in res.body, false);
});

test('legacy 500 error responses are sanitized as well', () => {
  const res = responseDouble();
  ApiResponse.error(res, '保存失败: ER_DUP_ENTRY users.email', 500);

  assert.equal(res.statusCode, 500);
  assert.equal(res.body.message, '服务器内部错误，请稍后重试');
});
