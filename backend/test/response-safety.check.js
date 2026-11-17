const test = require('node:test');
const assert = require('node:assert/strict');
const ApiResponse = require('../src/utils/response');
const { setupSecurityMiddleware } = require('../src/middleware');

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

test('client errors expose a stable code without duplicating it as error details', () => {
  const res = responseDouble();
  ApiResponse.error(res, '请先绑定工资模板', 422, 'SALARY_TEMPLATE_REQUIRED');

  assert.equal(res.statusCode, 422);
  assert.equal(res.body.code, 'SALARY_TEMPLATE_REQUIRED');
  assert.equal('error' in res.body, false);
});

test('Git push exposes only allowlisted operational guidance from sanitized 5xx responses', () => {
  const middleware = [];
  setupSecurityMiddleware({ use(handler) { middleware.push(handler); } });
  const attachResponseSanitizer = middleware[0];
  const req = {};
  const res = {
    statusCode: 502,
    locals: { safeErrorResponse: true },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
  attachResponseSanitizer(req, res, () => {});
  res.json({
    success: false,
    message: 'Git 远端认证失败',
    error: 'Git 远端认证失败',
    hint: '检查远端凭据',
    code: 'GIT_REMOTE_AUTH_FAILED',
    details: { stderr: 'credential=secret', syncStatus: { verified: false, hasUpstream: true, ahead: 2, behind: 0 } },
    stack: 'internal stack'
  });

  assert.deepEqual(res.body, {
    success: false,
    message: 'Git 远端认证失败',
    code: 'GIT_REMOTE_AUTH_FAILED',
    error: 'Git 远端认证失败',
    hint: '检查远端凭据',
    syncStatus: { verified: false, hasUpstream: true, ahead: 2, behind: 0 }
  });
});
