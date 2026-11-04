<!--
  ShopConfig - H5商城配置管理页面（员工端）
  功能：店铺基本信息、联系方式、支付方式配置
-->
<template>
  <PermissionGate
    :can-view="canView"
    mode="denied"
    module-key="h5-admin-config"
    module-name="商城配置"
    permission-code="h5-config:view"
  >
    <div class="shop-config-page">
      <!-- 加载状态 -->
      <div
        v-if="loading"
        class="loading-state"
      >
        <SectionLoading
          text="加载商城配置中..."
          size="large"
        />
      </div>

      <!-- 配置表单 -->
      <div
        v-else
        class="config-content"
      >
        <!-- 基本信息 -->
        <div class="config-section">
          <h3 class="section-title">
            基本信息
          </h3>
          <el-form
            class="config-form"
            label-width="120px"
            :disabled="!canEdit"
          >
            <el-form-item
              v-if="canViewField('shop.shop_name')"
              label="店铺名称"
            >
              <el-input
                v-model="configs.shop_name"
                placeholder="请输入店铺名称"
              />
            </el-form-item>
            <el-form-item
              v-if="canViewField('shop.shop_subtitle')"
              label="店铺副标题"
            >
              <el-input
                v-model="configs.shop_subtitle"
                placeholder="请输入店铺副标题"
              />
            </el-form-item>
            <el-form-item
              v-if="canViewField('shop.shop_logo')"
              label="店铺Logo"
            >
              <div class="image-upload-wrapper">
                <el-upload
                  :action="uploadAction"
                  :headers="uploadHeaders"
                  :data="{ module: 'h5_config' }"
                  :show-file-list="false"
                  :on-success="(res) => handleUploadSuccess(res, 'shop_logo')"
                  :before-upload="beforeUpload"
                  :disabled="!canEdit"
                  name="files"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  list-type="picture-card"
                >
                  <img
                    v-if="configs.shop_logo"
                    :src="getImagePreviewUrl(configs.shop_logo)"
                    class="uploaded-image"
                  >
                  <i
                    v-else
                    class="fas fa-plus"
                  />
                </el-upload>
                <el-button
                  v-if="configs.shop_logo && canEdit"
                  plain
                  type="danger"
                  size="small"
                  class="delete-image-btn btn-sm"
                  @click="handleDeleteImage('shop_logo')"
                >
                  <i class="fas fa-trash mr-1" />删除
                </el-button>
              </div>
            </el-form-item>
          </el-form>
        </div>

        <!-- 联系方式 -->
        <div class="config-section">
          <h3 class="section-title">
            联系方式
          </h3>
          <el-form
            class="config-form"
            label-width="120px"
            :disabled="!canEdit"
          >
            <el-form-item
              v-if="canViewField('contact.shop_phone')"
              label="联系电话"
            >
              <el-input
                v-model="configs.shop_phone"
                placeholder="请输入联系电话"
              />
            </el-form-item>
            <el-form-item
              v-if="canViewField('contact.wechat_id')"
              label="微信号"
            >
              <el-input
                v-model="configs.wechat_id"
                placeholder="请输入微信号"
              />
              <template #tip>
                <span class="tip-text">用户点击后将自动跳转到微信添加好友</span>
              </template>
            </el-form-item>
            <el-form-item
              v-if="canViewField('contact.shop_address')"
              label="店铺地址"
            >
              <el-input
                v-model="configs.shop_address"
                class="tf-textarea"
                type="textarea"
                :rows="2"
                placeholder="请输入店铺地址"
              />
            </el-form-item>
            <el-form-item
              v-if="canViewField('contact.shop_hours')"
              label="营业时间"
            >
              <el-input
                v-model="configs.shop_hours"
                placeholder="如：09:00-21:00"
              />
            </el-form-item>
          </el-form>
        </div>

        <!-- 支付方式 -->
        <div class="config-section">
          <h3 class="section-title">
            支付方式
          </h3>
          <el-form
            class="config-form"
            label-width="120px"
            :disabled="!canEdit"
          >
            <el-form-item
              v-if="canViewField('payment.default_method')"
              label="默认方式"
            >
              <el-select
                v-model="configs.payment_default_method"
                class="payment-default-select"
              >
                <el-option
                  v-for="option in availablePaymentMethods"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </el-form-item>
            <div class="payment-method-list">
              <div
                v-if="canViewField('payment.qr_wechat_enabled')"
                class="payment-method-row"
              >
                <span>微信二维码</span><span
                  class="payment-method-status"
                  :class="getPaymentStatusClass(configs.payment_qr_wechat_enabled, !!configs.wechat_qrcode)"
                >{{ getPaymentStatusText(configs.payment_qr_wechat_enabled, !!configs.wechat_qrcode) }}</span>
              </div>
              <div
                v-if="canViewField('payment.qr_alipay_enabled')"
                class="payment-method-row"
              >
                <span>支付宝二维码</span><span
                  class="payment-method-status"
                  :class="getPaymentStatusClass(configs.payment_qr_alipay_enabled, !!configs.alipay_qrcode)"
                >{{ getPaymentStatusText(configs.payment_qr_alipay_enabled, !!configs.alipay_qrcode) }}</span>
              </div>
              <div
                v-if="canViewField('payment.qr_other_enabled')"
                class="payment-method-row"
              >
                <span>{{ configs.payment_qr_other_name || '其他二维码' }}</span><span
                  class="payment-method-status"
                  :class="getPaymentStatusClass(configs.payment_qr_other_enabled, !!configs.other_qrcode && !!configs.payment_qr_other_name)"
                >{{ getPaymentStatusText(configs.payment_qr_other_enabled, !!configs.other_qrcode && !!configs.payment_qr_other_name) }}</span>
              </div>
              <div
                v-if="canViewField('payment.bank_enabled')"
                class="payment-method-row"
              >
                <span>银行转账</span><span
                  class="payment-method-status"
                  :class="getPaymentStatusClass(configs.payment_bank_enabled, !!configs.bank_info)"
                >{{ getPaymentStatusText(configs.payment_bank_enabled, !!configs.bank_info) }}</span>
              </div>
              <div
                v-if="canViewField('integration.wechat_pay_enabled')"
                class="payment-method-row"
              >
                <span>微信商家接口</span><span
                  class="payment-method-status"
                  :class="getMerchantStatusClass(configs.wechat_pay_enabled)"
                >{{ getMerchantStatusText(configs.wechat_pay_enabled, hasWechatMerchantConfig) }}</span>
              </div>
              <div
                v-if="canViewField('integration.alipay_pay_enabled')"
                class="payment-method-row"
              >
                <span>支付宝商家接口</span><span
                  class="payment-method-status"
                  :class="getMerchantStatusClass(configs.alipay_pay_enabled)"
                >{{ getMerchantStatusText(configs.alipay_pay_enabled, hasAlipayMerchantConfig) }}</span>
              </div>
              <div
                v-if="canViewField('integration.other_payment_enabled')"
                class="payment-method-row"
              >
                <span>{{ configs.payment_provider_name || '其他服务商接口' }}</span><span
                  class="payment-method-status"
                  :class="getMerchantStatusClass(configs.payment_merchant_other_enabled)"
                >{{ getMerchantStatusText(configs.payment_merchant_other_enabled, hasOtherMerchantConfig) }}</span>
              </div>
            </div>
          </el-form>
          <p class="tip-text payment-method-tip">
            支付方式的启停和接口资料统一在“支付接口”中维护。
          </p>
        </div>

        <div class="config-section">
          <h3 class="section-title">
            接口配置
          </h3>
          <div class="integration-entry-list">
            <el-button
              v-if="canViewField('integration.map_provider')"
              class="btn-sm"
              @click="showMapSettingsDialog = true"
            >
              地图接口
            </el-button>
            <el-button
              v-if="canViewField('integration.payment_provider')"
              class="btn-sm"
              @click="showPaymentSettingsDialog = true"
            >
              支付接口
            </el-button>
          </div>
        </div>

        <!-- 功能开关 -->
        <div class="config-section">
          <h3 class="section-title">
            功能设置
          </h3>
          <el-form
            class="config-form"
            label-width="120px"
            :disabled="!canEdit"
          >
            <el-form-item
              v-if="canViewField('features.banner_enabled')"
              label="启用轮播图"
            >
              <el-switch v-model="configs.banner_enabled" />
              <template #tip>
                <span class="tip-text">关闭后首页将不显示轮播图</span>
              </template>
            </el-form-item>
            <el-form-item
              v-if="canViewField('features.cart_enabled')"
              label="启用购物车"
            >
              <el-switch v-model="configs.cart_enabled" />
              <template #tip>
                <span class="tip-text">关闭后用户只能直接购买，无法使用购物车</span>
              </template>
            </el-form-item>
            <el-form-item
              v-if="canViewField('features.direct_buy_enabled')"
              label="启用直接购买"
            >
              <el-switch v-model="configs.direct_buy_enabled" />
              <template #tip>
                <span class="tip-text">关闭后用户只能通过购物车下单</span>
              </template>
            </el-form-item>
          </el-form>
        </div>

        <!-- 保存按钮 -->
        <div class="actions">
          <el-button
            v-if="canEdit"
            :loading="saving"
            plain
            type="primary"
            size="default"
            class="btn-sm"
            @click="handleSave"
          >
            <i class="fas fa-save mr-1" />保存
          </el-button>
        </div>
      </div>

      <!-- 地图接口配置 -->
      <MobileDialog
        v-model="showMapSettingsDialog"
        title="地图接口配置"
        width="620px"
        :close-on-click-modal="false"
        dialog-class="shop-config-service-dialog"
        :show-default-footer="false"
      >
        <el-form
          class="config-form service-dialog-form"
          label-width="120px"
          :disabled="!canEdit"
        >
          <el-form-item
            v-if="canViewField('integration.map_provider')"
            label="地图服务商"
          >
            <el-select v-model="configs.map_provider">
              <el-option
                label="腾讯地图"
                value="tencent"
              />
              <el-option
                label="高德地图（待接入）"
                value="amap"
              />
              <el-option
                label="百度地图（待接入）"
                value="baidu"
              />
            </el-select>
          </el-form-item>
          <el-form-item
            v-if="configs.map_provider === 'tencent' && canViewField('integration.tencent_map_key')"
            label="腾讯浏览器 Key"
          >
            <el-input
              v-model.trim="configs.tencent_map_key"
              type="password"
              show-password
              autocomplete="off"
              placeholder="请输入腾讯地图浏览器 Key"
            />
          </el-form-item>
          <el-form-item
            v-if="configs.map_provider === 'amap' && canViewField('integration.amap_map_key')"
            label="高德 Web Key"
          >
            <el-input
              v-model.trim="configs.amap_map_key"
              type="password"
              show-password
              autocomplete="off"
              placeholder="请输入高德地图 Web Key"
            />
          </el-form-item>
          <el-form-item
            v-if="configs.map_provider === 'baidu' && canViewField('integration.baidu_map_key')"
            label="百度 AK"
          >
            <el-input
              v-model.trim="configs.baidu_map_key"
              type="password"
              show-password
              autocomplete="off"
              placeholder="请输入百度地图浏览器 AK"
            />
          </el-form-item>
          <el-form-item
            v-if="canViewField('integration.map_location')"
            label="店铺位置"
          >
            <div class="service-location-fields">
              <el-input
                v-model.trim="configs.map_latitude"
                placeholder="纬度"
              />
              <el-input
                v-model.trim="configs.map_longitude"
                placeholder="经度"
              />
              <el-button
                v-if="showOperations && configs.map_provider === 'tencent'"
                class="btn-sm"
                plain
                type="primary"
                @click="openMapPicker"
              >
                选择位置
              </el-button>
            </div>
          </el-form-item>
          <p class="tip-text service-dialog-tip">
            目前已接入腾讯地图 SDK；高德和百度先保存服务商配置，完成对应 SDK 适配后再启用。
          </p>
        </el-form>
        <template #footer>
          <el-button
            class="btn-sm"
            @click="showMapSettingsDialog = false"
          >
            关闭
          </el-button>
          <el-button
            v-if="canEdit"
            class="btn-sm"
            plain
            type="primary"
            :loading="saving"
            @click="saveMapSettings"
          >
            保存
          </el-button>
        </template>
      </MobileDialog>

      <!-- 支付接口配置 -->
      <MobileDialog
        v-model="showPaymentSettingsDialog"
        title="支付接口配置"
        width="760px"
        :close-on-click-modal="false"
        dialog-class="shop-config-service-dialog"
        :show-default-footer="false"
      >
        <el-tabs
          v-model="paymentInterfaceTab"
          class="payment-interface-tabs tf-page-tabs"
        >
          <el-tab-pane
            label="二维码与转账"
            name="qr"
            class="tf-tab-panel"
          >
            <el-form
              class="config-form service-dialog-form"
              label-width="140px"
              :disabled="!canEdit"
            >
              <el-form-item
                v-if="canViewField('payment.qr_wechat_enabled')"
                label="微信二维码"
              >
                <el-switch v-model="configs.payment_qr_wechat_enabled" />
                <span class="interface-status-tip">{{ configs.wechat_qrcode ? '已上传收款码' : '请上传收款码' }}</span>
              </el-form-item>
              <el-form-item
                v-if="canViewField('payment.wechat_qrcode')"
                label="微信收款码"
              >
                <div class="image-upload-wrapper payment-image-upload-wrapper">
                  <el-upload
                    :action="uploadAction"
                    :headers="uploadHeaders"
                    :data="{ module: 'h5_config' }"
                    :show-file-list="false"
                    :on-success="(res) => handleUploadSuccess(res, 'wechat_qrcode')"
                    :before-upload="beforeUpload"
                    :disabled="!canEdit"
                    name="files"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    list-type="picture-card"
                  >
                    <img
                      v-if="configs.wechat_qrcode"
                      :src="getImagePreviewUrl(configs.wechat_qrcode)"
                      class="uploaded-image"
                    ><i
                      v-else
                      class="fas fa-plus"
                    />
                  </el-upload>
                  <el-button
                    v-if="configs.wechat_qrcode && canEdit"
                    class="btn-sm"
                    plain
                    type="danger"
                    @click="handleDeleteImage('wechat_qrcode')"
                  >
                    删除
                  </el-button>
                </div>
              </el-form-item>
              <el-form-item
                v-if="canViewField('payment.qr_alipay_enabled')"
                label="支付宝二维码"
              >
                <el-switch v-model="configs.payment_qr_alipay_enabled" />
                <span class="interface-status-tip">{{ configs.alipay_qrcode ? '已上传收款码' : '请上传收款码' }}</span>
              </el-form-item>
              <el-form-item
                v-if="canViewField('payment.alipay_qrcode')"
                label="支付宝收款码"
              >
                <div class="image-upload-wrapper payment-image-upload-wrapper">
                  <el-upload
                    :action="uploadAction"
                    :headers="uploadHeaders"
                    :data="{ module: 'h5_config' }"
                    :show-file-list="false"
                    :on-success="(res) => handleUploadSuccess(res, 'alipay_qrcode')"
                    :before-upload="beforeUpload"
                    :disabled="!canEdit"
                    name="files"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    list-type="picture-card"
                  >
                    <img
                      v-if="configs.alipay_qrcode"
                      :src="getImagePreviewUrl(configs.alipay_qrcode)"
                      class="uploaded-image"
                    ><i
                      v-else
                      class="fas fa-plus"
                    />
                  </el-upload>
                  <el-button
                    v-if="configs.alipay_qrcode && canEdit"
                    class="btn-sm"
                    plain
                    type="danger"
                    @click="handleDeleteImage('alipay_qrcode')"
                  >
                    删除
                  </el-button>
                </div>
              </el-form-item>
              <el-form-item
                v-if="canViewField('payment.qr_other_enabled')"
                label="其他二维码"
              >
                <el-switch v-model="configs.payment_qr_other_enabled" />
              </el-form-item>
              <el-form-item
                v-if="canViewField('payment.qr_other_name')"
                label="其他方式名称"
              >
                <el-input
                  v-model.trim="configs.payment_qr_other_name"
                  placeholder="方式名称，例如云闪付"
                />
              </el-form-item>
              <el-form-item
                v-if="canViewField('payment.other_qrcode')"
                label="自定义二维码"
              >
                <div class="image-upload-wrapper payment-image-upload-wrapper">
                  <el-upload
                    :action="uploadAction"
                    :headers="uploadHeaders"
                    :data="{ module: 'h5_config' }"
                    :show-file-list="false"
                    :on-success="(res) => handleUploadSuccess(res, 'other_qrcode')"
                    :before-upload="beforeUpload"
                    :disabled="!canEdit"
                    name="files"
                    accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                    list-type="picture-card"
                  >
                    <img
                      v-if="configs.other_qrcode"
                      :src="getImagePreviewUrl(configs.other_qrcode)"
                      class="uploaded-image"
                    ><i
                      v-else
                      class="fas fa-plus"
                    />
                  </el-upload>
                  <el-button
                    v-if="configs.other_qrcode && canEdit"
                    class="btn-sm"
                    plain
                    type="danger"
                    @click="handleDeleteImage('other_qrcode')"
                  >
                    删除
                  </el-button>
                </div>
              </el-form-item>
              <el-form-item
                v-if="canViewField('payment.bank_enabled')"
                label="银行转账"
              >
                <el-switch v-model="configs.payment_bank_enabled" />
              </el-form-item>
              <el-form-item
                v-if="canViewField('payment.bank_info')"
                label="银行转账信息"
              >
                <el-input
                  v-model="configs.bank_info"
                  class="tf-textarea"
                  type="textarea"
                  :rows="3"
                  placeholder="请输入银行账号、开户行等信息"
                />
              </el-form-item>
            </el-form>
          </el-tab-pane>
          <el-tab-pane
            label="微信商家接口"
            name="wechat"
            class="tf-tab-panel"
          >
            <el-form
              class="config-form service-dialog-form"
              label-width="140px"
              :disabled="!canEdit"
            >
              <el-form-item
                v-if="canViewField('integration.wechat_pay_enabled')"
                label="启用接口"
              >
                <el-switch v-model="configs.wechat_pay_enabled" />
                <span class="interface-status-tip">完成下单和回调配置后再启用</span>
              </el-form-item>
              <template v-if="canViewField('integration.wechat_pay_app_id')">
                <el-form-item label="微信 AppID">
                  <el-input
                    v-model.trim="configs.wechat_pay_app_id"
                    placeholder="请输入微信公众平台 AppID"
                  />
                </el-form-item>
                <el-form-item
                  v-if="canViewField('integration.wechat_pay_mch_id')"
                  label="微信商户号"
                >
                  <el-input
                    v-model.trim="configs.wechat_pay_mch_id"
                    placeholder="请输入微信支付商户号"
                  />
                </el-form-item>
                <el-form-item
                  v-if="canViewField('integration.wechat_pay_api_v3_key')"
                  label="微信 API v3 Key"
                >
                  <el-input
                    v-model.trim="configs.wechat_pay_api_v3_key"
                    type="password"
                    show-password
                    autocomplete="off"
                  />
                </el-form-item>
                <el-form-item
                  v-if="canViewField('integration.wechat_pay_private_key')"
                  label="微信商户私钥"
                >
                  <el-input
                    v-model="configs.wechat_pay_private_key"
                    class="tf-textarea"
                    type="textarea"
                    :rows="3"
                    autocomplete="off"
                    placeholder="粘贴微信支付商户私钥 PEM 内容"
                  />
                </el-form-item>
                <el-form-item
                  v-if="canViewField('integration.wechat_pay_serial_no')"
                  label="微信证书序列号"
                >
                  <el-input
                    v-model.trim="configs.wechat_pay_serial_no"
                    placeholder="请输入商户证书序列号"
                  />
                </el-form-item>
                <el-form-item
                  v-if="canViewField('integration.wechat_pay_notify_url')"
                  label="微信回调地址"
                >
                  <el-input
                    v-model.trim="configs.wechat_pay_notify_url"
                    placeholder="https://你的域名/api/payment/wechat/notify"
                  />
                </el-form-item>
              </template>
            </el-form>
          </el-tab-pane>
          <el-tab-pane
            label="支付宝商家接口"
            name="alipay"
            class="tf-tab-panel"
          >
            <el-form
              class="config-form service-dialog-form"
              label-width="140px"
              :disabled="!canEdit"
            >
              <el-form-item
                v-if="canViewField('integration.alipay_pay_enabled')"
                label="启用接口"
              >
                <el-switch v-model="configs.alipay_pay_enabled" />
                <span class="interface-status-tip">完成下单和回调配置后再启用</span>
              </el-form-item>
              <el-form-item
                v-if="canViewField('integration.alipay_app_id')"
                label="支付宝 AppID"
              >
                <el-input
                  v-model.trim="configs.alipay_app_id"
                  placeholder="请输入支付宝应用 AppID"
                />
              </el-form-item>
              <el-form-item
                v-if="canViewField('integration.alipay_private_key')"
                label="支付宝应用私钥"
              >
                <el-input
                  v-model="configs.alipay_private_key"
                  class="tf-textarea"
                  type="textarea"
                  :rows="3"
                  autocomplete="off"
                  placeholder="粘贴支付宝应用私钥内容"
                />
              </el-form-item>
              <el-form-item
                v-if="canViewField('integration.alipay_public_key')"
                label="支付宝公钥"
              >
                <el-input
                  v-model="configs.alipay_public_key"
                  class="tf-textarea"
                  type="textarea"
                  :rows="3"
                  autocomplete="off"
                  placeholder="粘贴支付宝公钥内容"
                />
              </el-form-item>
              <el-form-item
                v-if="canViewField('integration.alipay_notify_url')"
                label="支付宝回调地址"
              >
                <el-input
                  v-model.trim="configs.alipay_notify_url"
                  placeholder="https://你的域名/api/payment/alipay/notify"
                />
              </el-form-item>
            </el-form>
          </el-tab-pane>
          <el-tab-pane
            label="其他服务商"
            name="other"
            class="tf-tab-panel"
          >
            <el-form
              class="config-form service-dialog-form"
              label-width="140px"
              :disabled="!canEdit"
            >
              <el-form-item
                v-if="canViewField('integration.other_payment_enabled')"
                label="启用接口"
              >
                <el-switch v-model="configs.payment_merchant_other_enabled" />
                <span class="interface-status-tip">需提供服务商下单接口和回调协议</span>
              </el-form-item>
              <el-form-item
                v-if="canViewField('integration.payment_provider_name')"
                label="服务商名称"
              >
                <el-input
                  v-model.trim="configs.payment_provider_name"
                  placeholder="请输入支付公司名称"
                />
              </el-form-item>
              <el-form-item
                v-if="canViewField('integration.other_payment_api_url')"
                label="接口地址"
              >
                <el-input
                  v-model.trim="configs.other_payment_api_url"
                  placeholder="请输入服务商下单接口地址"
                />
              </el-form-item>
              <el-form-item
                v-if="canViewField('integration.other_payment_merchant_id')"
                label="商户标识"
              >
                <el-input
                  v-model.trim="configs.other_payment_merchant_id"
                  placeholder="请输入服务商商户标识"
                />
              </el-form-item>
              <el-form-item
                v-if="canViewField('integration.other_payment_secret')"
                label="接口密钥"
              >
                <el-input
                  v-model="configs.other_payment_secret"
                  type="password"
                  show-password
                  autocomplete="off"
                  placeholder="接口密钥将加密保存"
                />
              </el-form-item>
            </el-form>
          </el-tab-pane>
        </el-tabs>
        <p class="tip-text service-dialog-tip">
          只有启用开关和必要资料都完整的收款方式才会进入商城；商家接口还必须完成真实下单与回调验签适配。
        </p>
        <template #footer>
          <el-button
            class="btn-sm"
            @click="showPaymentSettingsDialog = false"
          >
            关闭
          </el-button>
          <el-button
            v-if="canEdit"
            class="btn-sm"
            plain
            type="primary"
            :loading="saving"
            @click="savePaymentSettings"
          >
            保存
          </el-button>
        </template>
      </MobileDialog>

      <!-- 地图选择对话框 -->
      <MobileDialog
        v-if="showOperations"
        v-model="showMapDialog"
        title="选择地图位置"
        width="900px"
        :close-on-click-modal="false"
        dialog-class="shop-config-map-dialog"
        :show-default-footer="false"
      >
        <div class="map-picker-container">
          <div class="map-instructions">
            <h4>操作说明：</h4>
            <ul>
              <li>🖱️ 在地图上点击选择店铺位置</li>
              <li>📍 拖动红色标记可以微调位置</li>
              <li>🔍 滚轮可以缩放地图</li>
              <li>✅ 选择好后点击"确定"保存</li>
            </ul>
            <div class="current-location">
              <strong>当前选中位置：</strong>
              <span v-if="selectedLocation.lat">
                纬度: {{ selectedLocation.lat }}, 经度: {{ selectedLocation.lng }}
              </span>
              <span v-else>请点击地图选择位置</span>
            </div>
          </div>
          <div
            id="map-container"
            class="map-frame"
          />
        </div>
        <template #footer>
          <el-button
            class="btn-sm"
            @click="cancelMapLocation"
          >
            取消
          </el-button>
          <el-button
            v-if="canEdit"
            plain
            type="primary"
            class="btn-sm"
            @click="confirmMapLocation"
          >
            确定
          </el-button>
        </template>
      </MobileDialog>
    </div>
  </PermissionGate>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onActivated, nextTick, inject, onUnmounted, watch } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh, Check } from '@element-plus/icons-vue'
import { getAllConfigs, batchUpdateConfigs } from '@/api/shop'
import SectionLoading from '@/components/SectionLoading.vue'
import { PermissionGate } from '@/components/base/index'
import { useAuthStore } from '@/stores/auth'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions, shouldShowActionColumn } from '@/composables/useFieldPermissions'
import { formatImageUrl } from '@/utils/format'
import { unifiedApi } from '@/utils/unified-api'
import { deleteTempFiles } from '@/utils/temp-file-cleaner'
import { logger } from '@/utils/logger'
import { ensureTencentMapKey, loadTencentMapScript } from '@/utils/tencent-map'
import type { HeaderAction } from '@/types'

const authStore = useAuthStore()
const configPermissions = usePagePermissions('h5-admin-config')
const { handleNoPermission } = configPermissions
const canView = computed(() => configPermissions.canView.value)
const canEdit = computed(() => configPermissions.canEdit.value)
const CONFIG_MODULE_KEY = 'h5_admin_configview'
const canViewField = (fieldKey: string) => fieldPermissions.isFieldVisible(CONFIG_MODULE_KEY, fieldKey)
const showOperations = computed(() => shouldShowActionColumn(
  canViewField('system_info.operations'),
  [canEdit.value]
))

// 注入父组件提供的注册方法
const registerHeaderActions = inject<(_actions: HeaderAction[]) => void>('registerHeaderActions')
const clearHeaderActions = inject<() => void>('clearHeaderActions')

const ensureEditPermission = () => {
  if (canEdit.value) {
    return true
  }
  handleNoPermission('edit')
  return false
}

type ShopConfigValue = string | number | boolean | null
interface ShopConfigForm {
  shop_name: string
  shop_logo: string
  shop_subtitle: string
  shop_phone: string
  wechat_id: string
  shop_address: string
  shop_hours: string
  map_latitude: string
  map_longitude: string
  map_provider: string
  tencent_map_key: string
  amap_map_key: string
  baidu_map_key: string
  payment_provider: string
  payment_default_method: string
  payment_qr_wechat_enabled: boolean
  payment_qr_alipay_enabled: boolean
  payment_qr_other_enabled: boolean
  payment_qr_other_name: string
  payment_bank_enabled: boolean
  payment_merchant_other_enabled: boolean
  wechat_pay_enabled: boolean
  alipay_pay_enabled: boolean
  wechat_pay_app_id: string
  wechat_pay_mch_id: string
  wechat_pay_api_v3_key: string
  wechat_pay_private_key: string
  wechat_pay_serial_no: string
  wechat_pay_notify_url: string
  alipay_app_id: string
  alipay_private_key: string
  alipay_public_key: string
  alipay_notify_url: string
  payment_provider_name: string
  other_payment_api_url: string
  other_payment_merchant_id: string
  other_payment_secret: string
  wechat_qrcode: string
  alipay_qrcode: string
  other_qrcode: string
  bank_info: string
  banner_enabled: boolean
  cart_enabled: boolean
  direct_buy_enabled: boolean
  [key: string]: ShopConfigValue
}

// 刷新配置
const handleRefresh = async () => {
  unifiedApi.clearCache('/shop')
  await cleanupTempImages()
  await loadConfigs()
}

// 配置数据
const configs = ref<ShopConfigForm>({
  shop_name: '',
  shop_logo: '',
  shop_subtitle: '',
  shop_phone: '',
  wechat_id: '',
  shop_address: '',
  shop_hours: '',
  map_latitude: '',
  map_longitude: '',
  map_provider: 'tencent',
  tencent_map_key: '',
  amap_map_key: '',
  baidu_map_key: '',
  payment_provider: 'manual',
  payment_default_method: 'pickup',
  payment_qr_wechat_enabled: false,
  payment_qr_alipay_enabled: false,
  payment_qr_other_enabled: false,
  payment_qr_other_name: '',
  payment_bank_enabled: false,
  payment_merchant_other_enabled: false,
  wechat_pay_enabled: false,
  alipay_pay_enabled: false,
  wechat_pay_app_id: '',
  wechat_pay_mch_id: '',
  wechat_pay_api_v3_key: '',
  wechat_pay_private_key: '',
  wechat_pay_serial_no: '',
  wechat_pay_notify_url: '',
  alipay_app_id: '',
  alipay_private_key: '',
  alipay_public_key: '',
  alipay_notify_url: '',
  payment_provider_name: '',
  other_payment_api_url: '',
  other_payment_merchant_id: '',
  other_payment_secret: '',
  wechat_qrcode: '',
  alipay_qrcode: '',
  other_qrcode: '',
  bank_info: '',
  banner_enabled: true,
  cart_enabled: true,
  direct_buy_enabled: true
})
const loading = ref(true)
const saving = ref(false)
const hasInitializedPageData = ref(false)
const showMapDialog = ref(false)
const showMapSettingsDialog = ref(false)
const showPaymentSettingsDialog = ref(false)
const paymentInterfaceTab = ref<'qr' | 'wechat' | 'alipay' | 'other'>('qr')
const IMAGE_FIELDS = ['shop_logo', 'wechat_qrcode', 'alipay_qrcode', 'other_qrcode'] as const
type ImageField = typeof IMAGE_FIELDS[number]
const originalImageConfigs = ref<Record<ImageField, string>>({
  shop_logo: '',
  wechat_qrcode: '',
  alipay_qrcode: '',
  other_qrcode: ''
})
const uploadedTempImages = ref<string[]>([])
const hasWechatMerchantConfig = computed(() => Boolean(
  configs.value.wechat_pay_app_id
  && configs.value.wechat_pay_mch_id
  && configs.value.wechat_pay_api_v3_key
  && configs.value.wechat_pay_private_key
  && configs.value.wechat_pay_serial_no
  && configs.value.wechat_pay_notify_url
))
const hasAlipayMerchantConfig = computed(() => Boolean(
  configs.value.alipay_app_id
  && configs.value.alipay_private_key
  && configs.value.alipay_public_key
  && configs.value.alipay_notify_url
))
const hasOtherMerchantConfig = computed(() => Boolean(
  configs.value.payment_provider_name
  && configs.value.other_payment_api_url
  && configs.value.other_payment_merchant_id
  && configs.value.other_payment_secret
))
const getPaymentStatusText = (enabled: boolean, complete: boolean) => {
  if (!enabled) return '已关闭'
  return complete ? '已开启' : '待完善'
}
const getMerchantStatusText = (enabled: boolean, complete: boolean) => {
  if (!enabled) return '已关闭'
  return complete ? '待接入' : '待完善'
}
const getPaymentStatusClass = (enabled: boolean, complete: boolean) => {
  if (!enabled) return 'is-disabled'
  return complete ? 'is-enabled' : 'is-incomplete'
}
const getMerchantStatusClass = (enabled: boolean) => enabled ? 'is-incomplete' : 'is-disabled'
const availablePaymentMethods = computed(() => [
  { value: 'pickup', label: '到店自提' },
  ...(configs.value.payment_qr_wechat_enabled && configs.value.wechat_qrcode ? [{ value: 'qr_wechat', label: '微信二维码' }] : []),
  ...(configs.value.payment_qr_alipay_enabled && configs.value.alipay_qrcode ? [{ value: 'qr_alipay', label: '支付宝二维码' }] : []),
  ...(configs.value.payment_qr_other_enabled && configs.value.other_qrcode && configs.value.payment_qr_other_name ? [{ value: 'qr_other', label: configs.value.payment_qr_other_name }] : []),
  ...(configs.value.payment_bank_enabled && configs.value.bank_info ? [{ value: 'bank', label: '银行转账' }] : [])
])

// 上传配置
const uploadAction = computed(() => `${import.meta.env.VITE_API_BASE_URL || '/api'}/shop/upload/image`)
const uploadHeaders = computed(() => ({
  'Authorization': `Bearer ${authStore.token}`
}))

const getImagePreviewUrl = (url: string) => formatImageUrl(url)

const isTempImage = (url: string) => uploadedTempImages.value.includes(url)

const trackTempImage = (url: string) => {
  if (!url || uploadedTempImages.value.includes(url)) {
    return
  }
  uploadedTempImages.value.push(url)
}

const untrackTempImage = (url: string) => {
  uploadedTempImages.value = uploadedTempImages.value.filter(item => item !== url)
}

const cleanupTempImages = async (files: string[] = uploadedTempImages.value) => {
  const targets = files.filter(Boolean)
  if (targets.length === 0) {
    return true
  }

  const success = await deleteTempFiles(targets)
  if (success) {
    targets.forEach((file) => untrackTempImage(file))
  }
  return success
}

const deleteSavedImage = async (imageUrl: string) => {
  if (!imageUrl) {
    return
  }

  await unifiedApi.post('/shop/delete-image', { image_url: imageUrl }, { showError: false })
}

const syncOriginalImageConfigs = () => {
  originalImageConfigs.value = {
    shop_logo: configs.value.shop_logo || '',
    wechat_qrcode: configs.value.wechat_qrcode || '',
    alipay_qrcode: configs.value.alipay_qrcode || '',
    other_qrcode: configs.value.other_qrcode || ''
  }
}

// 上传成功回调
const handleUploadSuccess = async (response: unknown, field: string) => {
  const fieldMap: Record<string, string> = {
    shop_logo: 'shop.shop_logo',
    wechat_qrcode: 'payment.wechat_qrcode',
    alipay_qrcode: 'payment.alipay_qrcode',
    other_qrcode: 'payment.other_qrcode'
  }
  if (!canViewField(fieldMap[field] || field)) {
    return
  }
  if (!ensureEditPermission()) {
    return
  }

  // el-upload 使用 raw axios，响应格式与 unified-api 不同
  // 成功时直接返回文件信息，或通过 response.data 包装
  const responseRecord = response && typeof response === 'object' ? response as Record<string, unknown> : {}
  const responseData = responseRecord.data && typeof responseRecord.data === 'object' ? responseRecord.data as Record<string, unknown> : {}
  const responseFiles = Array.isArray(responseData.files) ? responseData.files : []
  const firstFile = responseFiles[0] && typeof responseFiles[0] === 'object' ? responseFiles[0] as Record<string, unknown> : {}
  const fileUrl = (typeof firstFile.url === 'string' ? firstFile.url : undefined)
    || (typeof responseData.url === 'string' ? responseData.url : undefined)
    || (typeof responseRecord.url === 'string' ? responseRecord.url : undefined)

  if (fileUrl) {
    const imageField = field as ImageField
    const previousImageUrl = configs.value[imageField]

    if (previousImageUrl && previousImageUrl !== fileUrl && isTempImage(previousImageUrl)) {
      await cleanupTempImages([previousImageUrl])
    }

    configs.value[imageField] = fileUrl

    if (fileUrl !== originalImageConfigs.value[imageField]) {
      trackTempImage(fileUrl)
    }

    ElMessage.success('上传成功，请点击保存生效')
  } else {
    ElMessage.error('上传失败：响应格式错误')
  }
}

// 上传前验证
const beforeUpload = (file: File) => {
  if (!ensureEditPermission()) {
    return false
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
  const isImage = allowedTypes.includes(file.type)
  const isLt2M = file.size / 1024 / 1024 < 2

  if (!isImage) {
    logger.error('[beforeUpload] 不支持的文件类型:', file.type)
    ElMessage.error(`只支持上传图片文件（jpeg, png, gif, webp），当前文件类型: ${file.type}`)
    return false
  }
  if (!isLt2M) {
    ElMessage.error('图片大小不能超过 2MB!')
    return false
  }

  return true
}

// 删除图片
const handleDeleteImage = async (field: string) => {
  const fieldMap: Record<string, string> = {
    shop_logo: 'shop.shop_logo',
    wechat_qrcode: 'payment.wechat_qrcode',
    alipay_qrcode: 'payment.alipay_qrcode',
    other_qrcode: 'payment.other_qrcode'
  }
  if (!canViewField(fieldMap[field] || field)) {
    return
  }
  if (!ensureEditPermission()) {
    return
  }

  const imageField = field as ImageField
  const currentImageUrl = configs.value[imageField]
  if (!currentImageUrl) return

  try {
    if (isTempImage(currentImageUrl)) {
      await cleanupTempImages([currentImageUrl])
      ElMessage.success('临时图片已删除')
    } else {
      ElMessage.success('已移除图片，请点击保存生效')
    }

    configs.value[imageField] = ''
  } catch (error) {
    logger.error('删除图片失败:', error)
    configs.value[imageField] = ''
    ElMessage.warning('图片预览已移除，请保存后确认')
  }
}

// 加载配置
const loadConfigs = async () => {
  if (!canView.value) {
    loading.value = false
    return
  }

  loading.value = true
  try {
    const response = await getAllConfigs()
    // unifiedApi 返回 ApiResponse 格式，需要取 data
    const data = response.data || response

    // 将嵌套的配置转换为平铺的键值对
    configs.value = {} as ShopConfigForm
    const booleanFields = ['banner_enabled', 'cart_enabled', 'direct_buy_enabled', 'wechat_pay_enabled', 'alipay_pay_enabled', 'payment_qr_wechat_enabled', 'payment_qr_alipay_enabled', 'payment_qr_other_enabled', 'payment_bank_enabled', 'payment_merchant_other_enabled']
    Object.keys(data).forEach(category => {
      const categoryData = data[category]
      // 确保是数组才进行 forEach
      if (Array.isArray(categoryData)) {
        categoryData.forEach(item => {
          if (!item || typeof item !== 'object') return
          const configItem = item as Record<string, unknown>
          const itemKey = String(configItem.key || '')
          const itemValue = configItem.value as ShopConfigValue
          // 布尔类型字段转换为布尔值
          if (booleanFields.includes(itemKey)) {
            configs.value[itemKey] = itemValue === true || itemValue === 1 || itemValue === '1' || itemValue === 'true'
          } else {
            configs.value[itemKey] = itemValue
          }
        })
      }
    })
    configs.value.map_provider ||= 'tencent'
    configs.value.payment_provider ||= 'manual'
    configs.value.payment_default_method ||= 'pickup'
    configs.value.wechat_pay_enabled ??= false
    configs.value.alipay_pay_enabled ??= false
    configs.value.payment_qr_wechat_enabled ??= false
    configs.value.payment_qr_alipay_enabled ??= false
    configs.value.payment_qr_other_enabled ??= false
    configs.value.payment_bank_enabled ??= false
    configs.value.payment_merchant_other_enabled ??= false
    configs.value.tencent_map_key ??= ''
    for (const key of [
      'amap_map_key', 'baidu_map_key',
      'wechat_pay_app_id', 'wechat_pay_mch_id', 'wechat_pay_api_v3_key',
      'wechat_pay_private_key', 'wechat_pay_serial_no', 'wechat_pay_notify_url',
      'alipay_app_id', 'alipay_private_key', 'alipay_public_key', 'alipay_notify_url',
      'payment_provider_name', 'other_payment_api_url', 'other_payment_merchant_id', 'other_payment_secret',
      'payment_default_method', 'payment_qr_other_name', 'other_qrcode'
    ]) {
      configs.value[key] ??= ''
    }
    syncOriginalImageConfigs()
    uploadedTempImages.value = []
  } catch (error) {
    logger.error('获取配置失败:', error)
    ElMessage.error('获取配置失败')
  } finally {
    loading.value = false
  }
}

// 保存配置
const handleSave = async () => {
  if (saving.value) return false
  if (!ensureEditPermission()) {
    return false
  }

  saving.value = true
  try {
    if (!availablePaymentMethods.value.some(option => option.value === configs.value.payment_default_method)) {
      configs.value.payment_default_method = availablePaymentMethods.value[0]?.value || 'pickup'
    }
    const deletedSavedImages = IMAGE_FIELDS
      .map((field) => ({
        oldUrl: originalImageConfigs.value[field],
        newUrl: configs.value[field] || ''
      }))
      .filter(({ oldUrl, newUrl }) => Boolean(oldUrl) && oldUrl !== newUrl)

    // 转换为更新格式
    const configFieldMap: Record<string, string> = {
      shop_name: 'shop.shop_name',
      shop_subtitle: 'shop.shop_subtitle',
      shop_logo: 'shop.shop_logo',
      shop_phone: 'contact.shop_phone',
      wechat_id: 'contact.wechat_id',
      shop_address: 'contact.shop_address',
      map_latitude: 'integration.map_location',
      map_longitude: 'integration.map_location',
      map_provider: 'integration.map_provider',
      tencent_map_key: 'integration.tencent_map_key',
      amap_map_key: 'integration.amap_map_key',
      baidu_map_key: 'integration.baidu_map_key',
      payment_provider: 'integration.payment_provider',
      payment_default_method: 'payment.default_method',
      payment_qr_wechat_enabled: 'payment.qr_wechat_enabled',
      payment_qr_alipay_enabled: 'payment.qr_alipay_enabled',
      payment_qr_other_enabled: 'payment.qr_other_enabled',
      payment_qr_other_name: 'payment.qr_other_name',
      payment_bank_enabled: 'payment.bank_enabled',
      payment_merchant_other_enabled: 'integration.other_payment_enabled',
      payment_provider_name: 'integration.payment_provider_name',
      other_payment_api_url: 'integration.other_payment_api_url',
      other_payment_merchant_id: 'integration.other_payment_merchant_id',
      other_payment_secret: 'integration.other_payment_secret',
      wechat_pay_enabled: 'integration.wechat_pay_enabled',
      alipay_pay_enabled: 'integration.alipay_pay_enabled',
      wechat_pay_app_id: 'integration.wechat_pay_app_id',
      wechat_pay_mch_id: 'integration.wechat_pay_mch_id',
      wechat_pay_api_v3_key: 'integration.wechat_pay_api_v3_key',
      wechat_pay_private_key: 'integration.wechat_pay_private_key',
      wechat_pay_serial_no: 'integration.wechat_pay_serial_no',
      wechat_pay_notify_url: 'integration.wechat_pay_notify_url',
      alipay_app_id: 'integration.alipay_app_id',
      alipay_private_key: 'integration.alipay_private_key',
      alipay_public_key: 'integration.alipay_public_key',
      alipay_notify_url: 'integration.alipay_notify_url',
      shop_hours: 'contact.shop_hours',
      wechat_qrcode: 'payment.wechat_qrcode',
      alipay_qrcode: 'payment.alipay_qrcode',
      other_qrcode: 'payment.other_qrcode',
      bank_info: 'payment.bank_info',
      banner_enabled: 'features.banner_enabled',
      cart_enabled: 'features.cart_enabled',
      direct_buy_enabled: 'features.direct_buy_enabled'
    }
    const configArray = Object.entries(configs.value)
      .filter(([key]) => canViewField(configFieldMap[key] || key))
      .map(([key, value]) => ({ key, value: String(value) }))

    await batchUpdateConfigs(configArray)

    for (const { oldUrl } of deletedSavedImages) {
      try {
        await deleteSavedImage(oldUrl)
      } catch (error) {
        logger.warn('删除旧图片失败', { oldUrl, error })
      }
    }

    syncOriginalImageConfigs()
    uploadedTempImages.value = []
    ElMessage.success('配置保存成功')
    return true
  } catch (error: unknown) {
    logger.error('保存配置失败:', error)
    ElMessage.error(error instanceof Error ? error.message : '保存配置失败')
    return false
  } finally {
    saving.value = false
  }
}

// 地图选择相关
const selectedLocation = ref({ lat: '', lng: '' })
interface TencentMapInstance {
  on: (_event: string, _callback: (_event: unknown) => void) => void
}

interface TencentMarkerInstance {
  setGeometries: (_geometries: Array<Record<string, unknown>>) => void
}

let map: TencentMapInstance | null = null
let marker: TencentMarkerInstance | null = null

const openMapPicker = async () => {
  if (!ensureEditPermission()) {
    return
  }

  if (configs.value.map_provider !== 'tencent') {
    ElMessage.info('当前地图服务商尚未接入地图选点')
    return
  }

  const mapKey = ensureTencentMapKey(configs.value.tencent_map_key)
  if (!mapKey) {
    return
  }

  showMapDialog.value = true

  // 如果已有坐标，设置当前选中位置
  if (configs.value.map_latitude && configs.value.map_longitude) {
    selectedLocation.value = {
      lat: configs.value.map_latitude,
      lng: configs.value.map_longitude
    }
  } else {
    // 默认位置（深圳市福田区华强北）
    selectedLocation.value = { lat: '22.5431', lng: '114.0579' }
  }

  // 先加载地图脚本，然后等待对话框渲染完成后初始化地图
  try {
    await loadTencentMapScript(mapKey)
    await nextTick()
    setTimeout(() => {
      initMap()
    }, 300) // 额外延迟确保 DOM 完全渲染
  } catch (error) {
    logger.error('地图脚本加载失败:', error)
    ElMessage.error('地图加载失败，请检查网络连接')
  }
}

const initMap = () => {
  const container = document.getElementById('map-container')
  if (!container) return

  // 检查 TMap 是否已加载
  const tMap = window.TMap
  if (!tMap) {
    container.innerHTML = '<div class="map-loading-container">地图加载中...</div>'
    loadTencentMapScript(configs.value.tencent_map_key).then(() => {
      initMap()
    }).catch(() => {
      container.innerHTML = '<div class="map-error-container"><i class="fas fa-exclamation-circle"></i><div>地图加载失败</div><div class="map-error-tip">请检查网络或稍后重试</div></div>'
    })
    return
  }

  const lat = parseFloat(selectedLocation.value.lat)
  const lng = parseFloat(selectedLocation.value.lng)

  try {
    // 创建地图实例
    map = new tMap.Map(container, {
      center: new tMap.LatLng(lat, lng),
      zoom: 15,
      viewMode: '2D'
    })

    // 创建标记
    marker = new tMap.MultiMarker({
      map: map,
      styles: {
        'marker': new tMap.MarkerStyle({
          width: 25,
          height: 35,
          anchor: { x: 12, y: 35 }
        })
      },
      geometries: [{
        id: 'marker',
        styleId: 'marker',
        position: new tMap.LatLng(lat, lng),
        properties: { title: '店铺位置' }
      }]
    })

    // 监听地图点击事件
    map.on('click', (evt: unknown) => {
      const eventRecord = evt && typeof evt === 'object' ? evt as { latLng?: { lat: number; lng: number } } : {}
      const latLng = eventRecord.latLng
      if (!latLng || !marker) return
      selectedLocation.value = {
        lat: latLng.lat.toFixed(6),
        lng: latLng.lng.toFixed(6)
      }

      // 更新标记位置
      marker.setGeometries([{
        id: 'marker',
        styleId: 'marker',
        position: new tMap.LatLng(latLng.lat, latLng.lng),
        properties: { title: '店铺位置' }
      }])
    })
  } catch (error) {
    logger.error('地图初始化失败:', error)
    container.innerHTML = '<div class="map-error-container"><i class="fas fa-exclamation-circle"></i><div>地图初始化失败</div><div class="map-error-tip">请检查API Key配置</div></div>'
  }
}

const _handleMapLocationSelect = (location: { lat: string; lng: string }) => {
  selectedLocation.value = location
}

const confirmMapLocation = () => {
  if (!ensureEditPermission()) {
    return
  }

  configs.value.map_latitude = selectedLocation.value.lat
  configs.value.map_longitude = selectedLocation.value.lng
  showMapDialog.value = false
  ElMessage.success('地图位置已设置')
}

const cancelMapLocation = () => {
  showMapDialog.value = false
}

const saveMapSettings = async () => {
  if (await handleSave()) showMapSettingsDialog.value = false
}

const savePaymentSettings = async () => {
  if (await handleSave()) showPaymentSettingsDialog.value = false
}

const initializePageData = async () => {
  if (!canView.value) {
    loading.value = false
    return
  }

  if (hasInitializedPageData.value) {
    return
  }

  hasInitializedPageData.value = true
  await loadConfigs()
}

const registerPageHeaderActions = () => {
  if (registerHeaderActions) {
    registerHeaderActions([
      ...(canEdit.value ? [{
        label: '保存',
        type: 'primary' as const,
        icon: Check,
        loading: () => saving.value,
        handler: handleSave
      }] : []),
      {
        label: '刷新',
        type: 'default',
        icon: Refresh,
        disabled: () => loading.value,
        handler: handleRefresh
      }
    ])
  }
}

watch(canView, (allowed) => {
  if (allowed) {
    void initializePageData()
  }
})

watch(canEdit, () => {
  registerPageHeaderActions()
})

onMounted(() => {
  void fieldPermissions.init()
  void initializePageData()
  registerPageHeaderActions()
})

// KeepAlive 切换回来时重新注册当前页面的头部操作
onActivated(() => {
  registerPageHeaderActions()
})

// 路由守卫：页面离开时清理临时文件
onBeforeRouteLeave(async () => {
  await cleanupTempImages()
  return true
})

onUnmounted(() => {
  void cleanupTempImages()
  if (clearHeaderActions) {
    clearHeaderActions()
  }
})
</script>

<style scoped lang="scss">
@use './config-page.scss';

.shop-config-page {
  padding: 24px;
  min-width: 0;
}

// 加载状态
.loading-state {
  padding: 40px;
}

// 配置内容
.config-content {
  max-width: 800px;
  margin: 0 auto;
  min-width: 0;
}

// 配置区块
.config-section {
  background: var(--color-bg-white);
  border-radius: 8px;
  padding: 24px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  min-width: 0;

  .section-title {
    font-size: var(--tf-type-scale-18);
    font-weight: 500;
    color: var(--text-primary);
    margin: 0 0 20px;
    padding-left: 12px;
    border-left: 3px solid var(--tf-color-accent-orange);
  }

  :deep(.el-form-item__tip) {
    .tip-text {
      font-size: var(--tf-type-scale-12);
      color: var(--text-muted);
    }
  }

  // 上传图片样式
  .image-upload-wrapper {
    display: flex;
    align-items: center;
    gap: 12px;

    :deep(.el-upload) {
      width: 100px;
      height: 100px;
      line-height: 100px;

      .uploaded-image {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      i {
        font-size: var(--tf-type-scale-28);
        color: var(--tf-color-gray-element);
      }
    }

    .delete-image-btn {
      flex-shrink: 0;
    }
  }

  :deep(.el-upload) {
    width: 100px;
    height: 100px;
    line-height: 100px;

    .uploaded-image {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    i {
      font-size: var(--tf-type-scale-28);
      color: var(--tf-color-gray-element);
    }
  }
}

.map-location-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.map-coordinate-inputs {
  flex: 1 1 auto;
  min-width: 0;
}

// 操作按钮
.actions {
  display: flex;
  justify-content: center;
  padding: 32px 0;

  .el-button {
    width: 200px;
  }
}

// 地图选择器样式
.map-picker-container {
  .map-instructions {
    margin-bottom: 16px;
    padding: 16px;
    background: var(--tf-color-surface);
    border-radius: 8px;

    h4 {
      margin: 0 0 12px;
      font-size: var(--tf-type-scale-14);
      color: var(--text-primary);
    }

    ul {
      margin: 0 0 12px;
      padding-left: 20px;

      li {
        margin-bottom: 4px;
        font-size: var(--tf-type-scale-13);
        color: var(--text-secondary);
      }
    }

    .current-location {
      padding: 8px 12px;
      background: var(--color-bg-white);
      border-radius: 4px;
      font-size: var(--tf-type-scale-13);
      color: var(--text-primary);

      strong {
        color: var(--tf-color-accent-orange);
      }
    }
  }

  .map-frame {
    height: 400px;
    border: 1px solid var(--tf-color-border-element);
    border-radius: 8px;
    overflow: hidden;
  }
}

// 响应式设计
@media (max-width: 767px) {
  .shop-config-page {
    padding: 0;
    width: 100%;
    overflow: hidden;
  }

  .config-content {
    max-width: 100%;
    width: 100%;
  }

  .config-section {
    padding: 14px;
    margin-bottom: 12px;
    border-radius: 14px;
    border: 1px solid rgba(226, 232, 240, 0.88);
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);

    .section-title {
      margin-bottom: 14px;
      padding-left: 10px;
      font-size: var(--tf-type-scale-15);
      font-weight: 700;
    }
  }

  .config-section :deep(.config-form) {
    width: 100%;
  }

  .config-section :deep(.el-form-item) {
    display: block;
    margin-bottom: 15px;
  }

  .config-section :deep(.el-form-item:last-child) {
    margin-bottom: 0;
  }

  .config-section :deep(.el-form-item__label) {
    width: 100% !important;
    height: auto;
    margin-bottom: 7px;
    padding: 0 !important;
    color: var(--tf-color-slate-700);
    font-size: var(--tf-type-scale-13);
    font-weight: 700;
    line-height: 1.4;
    text-align: left;
  }

  .config-section :deep(.el-form-item__content) {
    width: 100%;
    min-width: 0;
    margin-left: 0 !important;
    line-height: 1.4;
  }

  .config-section :deep(.el-input),
  .config-section :deep(.el-textarea) {
    width: 100%;
  }

  .config-section :deep(.el-form-item__tip),
  .tip-text {
    display: block;
    margin-top: 6px;
    font-size: var(--tf-type-scale-12);
    line-height: 1.45;
  }

  .config-section .image-upload-wrapper {
    align-items: flex-start;
    gap: 10px;
    width: 100%;
  }

  .config-section .image-upload-wrapper :deep(.el-upload),
  .config-section :deep(.el-upload) {
    width: 82px;
    height: 82px;
    line-height: 82px;
    border-radius: 14px;
  }

  .config-section .image-upload-wrapper :deep(.el-upload i),
  .config-section :deep(.el-upload i) {
    font-size: var(--tf-type-scale-22);
  }

  .config-section .delete-image-btn {
    min-height: 32px;
    padding: 6px 10px;
  }

  .map-location-row {
    flex-direction: column;
    gap: 10px;
  }

  .map-coordinate-inputs {
    width: 100%;
  }

  .map-location-row .el-button {
    width: 100%;
  }

  .map-picker-container .map-instructions {
    margin-bottom: 12px;
    padding: 12px;
    border-radius: 12px;
  }

  .map-picker-container .map-instructions h4 {
    margin-bottom: 8px;
    font-size: var(--tf-type-scale-13);
  }

  .map-picker-container .map-instructions ul {
    padding-left: 18px;
  }

  .map-picker-container .map-instructions ul li,
  .map-picker-container .map-instructions .current-location {
    font-size: var(--tf-type-scale-12);
    line-height: 1.45;
  }

  .map-picker-container .map-frame {
    height: min(46vh, 320px);
    min-height: 240px;
    border-radius: 12px;
  }

  .actions {
    position: sticky;
    bottom: 0;
    z-index: 2;
    margin: 0 -2px;
    padding: 10px 0 calc(10px + env(safe-area-inset-bottom));
    background: linear-gradient(180deg, rgba(245, 247, 250, 0), rgba(245, 247, 250, 0.96) 34%, var(--tf-color-surface));

    .el-button {
      width: 100%;
      max-width: none;
      min-height: 40px;
      border-radius: 999px;
    }
  }
}

@media (max-width: 479px) {
  .config-section {
    padding: 12px;
  }

  .config-section .image-upload-wrapper {
    flex-direction: column;
    align-items: stretch;
  }

  .config-section .delete-image-btn {
    width: 100%;
  }

  .map-picker-container .map-frame {
    height: 240px;
  }
}

@media (max-width: 767px) {
  :global(.shop-config-map-dialog .mobile-dialog-sheet-body) {
    padding: 12px !important;
  }
}

</style>
