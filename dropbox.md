https://www.dropbox.com/oauth2/authorize?
  client_id=YOUR_APP_KEY&
  response_type=code&
  redirect_uri=YOUR_REDIRECT_URI&
  state=STATE&
  token_access_type=offline&
  scope=SCOPES


关键参数说明：

client_id: 您的 Dropbox 应用密钥
response_type: 对于授权码流程，应该是 code
redirect_uri: 必须与您在 Dropbox 开发者控制台中配置的重定向 URI 完全匹配
state: 用于防止 CSRF 攻击的随机字符串
token_access_type: 设置为 offline 可以获取刷新令牌
scope: 请求的权限范围，如 files.content.read files.content.write