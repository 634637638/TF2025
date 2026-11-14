// 本文件由 npm --prefix frontend run generate:openapi 生成，请修改唯一 OpenAPI 契约。
export interface paths {
    '/regions': {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * 按父级编码读取版本化地区选项
         * @description 只读公共基础资料，须通过统一登录认证，不读写客户数据。当前数据覆盖及截止日期由响应声明；港澳台乡村级不在此数据集内。GET 无 CSRF 写入副作用。
         */
        get: operations['getRegionChildren'];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        RegionOption: {
            code: string;
            name: string;
        };
        /** @description 唯一地区选择类型。省份沿用两位编码，其他层级保存展示名称。未选择为字符串空值；乡村为可选，兼容存量三级表单。 */
        RegionSelection: {
            province: string;
            city: string;
            district: string;
            town?: string;
            village?: string;
        };
        RegionChildren: {
            /** Format: date */
            version: string;
            coverage: string;
            options: components['schemas']['RegionOption'][];
        };
        RegionResponse: {
            /** @constant */
            success: true;
            message: string;
            /** Format: date-time */
            timestamp: string;
            data: components['schemas']['RegionChildren'];
        };
        ErrorResponse: {
            /** @constant */
            success: false;
            message: string;
            code?: string;
            /** Format: date-time */
            timestamp?: string;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    getRegionChildren: {
        parameters: {
            query?: {
                parent?: string;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description 地区选项 */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    'application/json': components['schemas']['RegionResponse'];
                };
            };
            /** @description 父级编码格式无效或重复参数 */
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    'application/json': components['schemas']['ErrorResponse'];
                };
            };
            /** @description 未登录或登录状态失效 */
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    'application/json': components['schemas']['ErrorResponse'];
                };
            };
            /** @description 不在当前版本覆盖范围或没有下级记录 */
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    'application/json': components['schemas']['ErrorResponse'];
                };
            };
            /** @description 资源缺失或校验失败，不能暴露服务器路径 */
            500: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    'application/json': components['schemas']['ErrorResponse'];
                };
            };
        };
    };
}
