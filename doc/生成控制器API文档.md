使用`Swagger`生成控制器 API 在线说明文档。

# 配置

`config/swagger.js`文件中指定配置信息，只有存在这个文件才开启`Swagger`服务。

| 配置项                           | 说明                                                  | 类型     | 默认值                                                                                |
| -------------------------------- | ----------------------------------------------------- | -------- | ------------------------------------------------------------------------------------- |
| definition                       |                                                       | object   |                                                                                       |
| definition.openapi               | 规范版本                                              | string   | 若不指定，默认为：openapi: '3.0.0'，版本号可以通过环境变量`TMS_KOA_OAS_VERSION`指定。 |
| definition.info                  |                                                       | object   |                                                                                       |
| definition.info.title            |                                                       | object   |                                                                                       |
| definition.info.version          |                                                       | object   |                                                                                       |
| definition.servers               |                                                       | [object] | 提供 API 服务的地址列表。                                                             |
| definition.servers[].url         |                                                       | string   |                                                                                       |
| definition.servers[].description |                                                       | string   |                                                                                       |
| apis                             | 包含 API 的文件路径，起始位置是 node 运行的当前路径。 | [string] | `./controllers/**/*.js`，控制器目录下的所有代码。                                     |

参看：[OpenAPI Specification](http://spec.openapis.org/oas/v3.0.3)

前缀`prefix`在`config/app.js`文件中`router.swagger.prefix`指定。若不指定，默认值为`oas`。

API 定义访问地址为`http://host:port/prefix`，例如：`http://host:port/oas`。

# 访问

首次访问时遍历所有指定的文件生成定义，所以首次访问时间会较长。

在`url`中，通过添加查询参数`refresh=Y`，强制要求重新遍历所有配置文件中指定的文件。配置文件变更，只能重启服务，这种方式并不适用。
