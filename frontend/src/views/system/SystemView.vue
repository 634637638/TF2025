<template>
  <div class="system-management admin-page">
    <PermissionGate
      :can-view="canView"
      mode="denied"
      module-key="system"
      module-name="系统管理"
      permission-code="system:view"
    >
      <!-- 页面头部 -->
      <PageHeader
        icon="fas fa-cogs"
        title="系统管理"
      >
        <template #actions>
          <el-button
            v-if="canViewField('warning.config') && activeTab === 'warning' && canUpdateSettings"
            type="primary"
            @click="openWarningTemplateDialog"
          >
            <i class="fas fa-plus" />
            <span>新增</span>
          </el-button>
          <el-button
            v-if="canViewField('system_info.operations')"
            type="info"
            :disabled="refreshing"
            @click="refreshSystemStatus"
          >
            <InlineLoading
              v-if="refreshing"
              text="刷新中..."
              size="small"
              variant="inherit"
            />
            <template v-else>
              <i class="fas fa-sync-alt" />
              <span>刷新</span>
            </template>
          </el-button>
        </template>
      </PageHeader>

      <!-- 系统功能模块 -->
      <div class="system-container admin-page-content">
        <!-- TAB导航 -->
        <div class="tab-navigation tf-page-tabs">
          <el-button
            v-if="canViewField('settings.site_info') || canViewField('settings.logo')"
            :type="activeTab === 'settings' ? 'primary' : 'default'"
            :icon="Setting"
            @click="activeTab = 'settings'"
          >
            站点信息
          </el-button>
          <el-button
            v-if="canViewField('settings.price_watermark')"
            :type="activeTab === 'price' ? 'primary' : 'default'"
            @click="activeTab = 'price'"
          >
            <i class="fas fa-tags" />
            报价信息
          </el-button>
          <el-button
            v-if="canViewField('screen_lock.config')"
            :type="activeTab === 'screenlock' ? 'primary' : 'default'"
            :icon="Lock"
            @click="activeTab = 'screenlock'"
          >
            锁屏设置
          </el-button>
          <el-button
            v-if="canViewField('warning.config')"
            :type="activeTab === 'warning' ? 'primary' : 'default'"
            @click="activeTab = 'warning'"
          >
            <i class="fas fa-bell" />
            预警配置
          </el-button>
          <el-button
            v-if="canViewReturngoods"
            data-view-permission="return-goods:view"
            :type="activeTab === 'returngoods' ? 'primary' : 'default'"
            @click="activeTab = 'returngoods'"
          >
            <i class="fas fa-undo-alt" />
            退库管理
          </el-button>
        </div>

        <!-- TAB内容区域 -->
        <div class="tab-content tf-tab-content">
          <!-- 站点信息TAB -->
          <div
            v-if="activeTab === 'settings' && (canViewField('settings.site_info') || canViewField('settings.logo'))"
            class="tab-panel tf-tab-panel"
          >
            <div class="system-settings-section">
              <!-- 站点 Logo 设置和编辑站点信息 - PC端一行展示 -->
              <div class="site-settings-row">
                <div
                  v-if="canViewField('settings.logo')"
                  class="site-logo-panel admin-panel"
                >
                  <div class="card-header-with-action">
                    <h3 class="card-title">
                      <i class="fas fa-image" />
                      站点 Logo 设置
                    </h3>
                    <el-button
                      v-if="canViewField('system_info.operations')"
                      type="primary"
                      size="small"
                      :loading="isLoading"
                      :disabled="!canUpdateSettings"
                      @click="saveSiteSettings"
                    >
                      <span v-if="isLoading">保存中...</span>
                      <template v-else>
                        <i class="fas fa-save" />
                        <span>保存</span>
                      </template>
                    </el-button>
                  </div>

                  <div
                    class="site-logo-preview-card"
                    :class="{ clickable: canUpdateSettings && !logoUploading }"
                    :tabindex="canUpdateSettings && !logoUploading ? 0 : -1"
                    :role="canUpdateSettings && !logoUploading ? 'button' : undefined"
                    @click="triggerSiteLogoUpload"
                    @keydown.enter.prevent="triggerSiteLogoUpload"
                    @keydown.space.prevent="triggerSiteLogoUpload"
                  >
                    <div
                      v-if="siteLogoPreviewUrl"
                      class="site-logo-preview"
                    >
                      <Image
                        :src="siteLogoPreviewUrl"
                        alt="站点Logo预览"
                        mode="eager"
                      />
                    </div>
                    <div
                      v-else
                      class="site-logo-empty"
                    >
                      <i class="fas fa-image" />
                      <span>暂无站点 Logo</span>
                    </div>
                    <div
                      v-if="canUpdateSettings"
                      class="site-logo-preview-tip"
                    >
                      {{ logoUploading ? '上传中...' : '点击这里选择新照片 / Logo' }}
                    </div>
                  </div>

                  <div class="site-logo-editor">
                    <div class="logo-editor-header">
                      <h3>
                        <i class="fas fa-image" />
                        站点 Logo 设置
                      </h3>
                      <el-tag
                        type="success"
                        size="small"
                      >
                        页面顶部显示
                      </el-tag>
                    </div>

                    <p class="logo-editor-tip">
                      用于页面顶部和移动端菜单展示。上传后会自动保存到系统设置，支持透明底 PNG、SVG 和 ICO。
                    </p>

                    <el-input
                      v-model="siteSettings.logoUrl"
                      placeholder="可直接输入 Logo 图片地址，或使用下方按钮上传"
                      :disabled="!canUpdateSettings"
                      clearable
                    />

                    <div class="site-logo-actions">
                      <el-button
                        type="primary"
                        :loading="logoUploading"
                        :disabled="!canUpdateSettings"
                        @click="triggerSiteLogoUpload"
                      >
                        <span v-if="logoUploading">上传中...</span>
                        <template v-else>
                          <i class="fas fa-upload" />
                          <span>上传 Logo</span>
                        </template>
                      </el-button>
                      <el-button
                        v-if="siteSettings.logoUrl"
                        type="default"
                        :disabled="logoUploading || !canUpdateSettings"
                        @click="clearSiteLogo"
                      >
                        <i class="fas fa-trash-alt" />
                        <span>清空 Logo</span>
                      </el-button>
                    </div>

                    <div class="logo-editor-help">
                      支持 JPG、PNG、GIF、ICO，文件大小不超过 5MB。
                    </div>

                    <input
                      ref="siteLogoInputRef"
                      type="file"
                      :accept="SITE_LOGO_ACCEPT"
                      class="site-logo-hidden-input"
                      @change="handleSiteLogoFileChange"
                    >
                  </div>
                </div>

                <!-- 站点信息编辑表格 -->
                <div class="table-section site-settings-table admin-panel admin-table-panel">
                  <div class="card-header-with-action">
                    <h3 class="section-subtitle">
                      <i class="fas fa-edit" />
                      编辑站点信息
                    </h3>
                    <el-button
                      v-if="canViewField('system_info.operations')"
                      type="primary"
                      size="small"
                      :loading="isLoading"
                      :disabled="!canUpdateSettings"
                      @click="saveSiteSettings"
                    >
                      <span v-if="isLoading">保存中...</span>
                      <template v-else>
                        <i class="fas fa-save" />
                        <span>保存</span>
                      </template>
                    </el-button>
                  </div>
                  <el-table
                    class="data-table compact-fit-table"
                    :data="visibleSiteSettingsList"
                    border
                    stripe
                    table-layout="auto"
                    :fit="true"
                  >
                    <el-table-column
                      prop="category"
                      label="分类"
                      min-width="120"
                      align="center"
                    >
                      <template #default="{ row }">
                        <el-tag
                          :type="row.category === 'basic' ? 'primary' : 'success'"
                          size="small"
                        >
                          {{ row.categoryLabel }}
                        </el-tag>
                      </template>
                    </el-table-column>

                    <el-table-column
                      prop="label"
                      label="设置项"
                      min-width="150"
                    >
                      <template #default="{ row }">
                        <i :class="row.icon" />
                        {{ row.label }}
                      </template>
                    </el-table-column>

                    <el-table-column
                      prop="value"
                      label="当前值"
                      min-width="160"
                    >
                      <template #default="{ row }">
                        <el-input
                          v-if="row.type === 'input'"
                          v-model="siteSettings[row.key]"
                          :placeholder="row.placeholder"
                          :disabled="!canUpdateSettings"
                          clearable
                        />
                        <el-input
                          v-else-if="row.type === 'textarea'"
                          v-model="siteSettings[row.key]"
                          type="textarea"
                          :rows="2"
                          :placeholder="row.placeholder"
                          :disabled="!canUpdateSettings"
                          clearable
                        />
                        <el-switch
                          v-else-if="row.type === 'switch'"
                          v-model="siteSettings[row.key]"
                          active-value="1"
                          inactive-value="0"
                          :disabled="!canUpdateSettings"
                        />
                        <span v-else>{{ siteSettings[row.key] || row.defaultValue }}</span>
                      </template>
                    </el-table-column>
                  </el-table>
                </div>
              </div>
            </div>
          </div>

          <!-- 报价信息TAB -->
          <div
            v-if="activeTab === 'price' && canViewField('settings.price_watermark')"
            class="tab-panel tf-tab-panel"
          >
            <div class="table-section site-settings-table admin-panel admin-table-panel">
              <div class="price-config-grid">
                <div
                  v-if="canViewField('settings.price_watermark')"
                  class="setting-card price-contact-card"
                >
                  <div class="card-header-with-action">
                    <h3 class="section-subtitle">
                      <i class="fas fa-tags" />报价联系人
                    </h3>
                    <el-button
                      v-if="canViewField('system_info.operations')"
                      type="primary"
                      size="small"
                      :disabled="!canUpdateSettings"
                      @click="openPriceContactDialog()"
                    >
                      <i class="fas fa-plus" /><span>新增联系人</span>
                    </el-button>
                  </div>
                  <el-table
                    :data="priceContactsEditor"
                    border
                    stripe
                    class="data-table compact-fit-table"
                    table-layout="auto"
                    :fit="true"
                  >
                    <el-table-column
                      v-if="canViewField('settings.price_watermark')"
                      type="index"
                      label="排序"
                      width="72"
                      align="center"
                    />
                    <el-table-column
                      v-if="canViewField('settings.price_watermark')"
                      prop="name"
                      label="姓名"
                      min-width="140"
                      align="center"
                    />
                    <el-table-column
                      v-if="canViewField('settings.price_watermark')"
                      prop="phone"
                      label="手机号码"
                      min-width="160"
                      align="center"
                    />
                    <el-table-column
                      v-if="canViewField('system_info.operations')"
                      label="操作"
                      :width="$getActionColumnWidth(4)"
                      align="center"
                      class-name="actions-column"
                    >
                      <template #default="{ $index, row }">
                        <div class="action-buttons">
                          <el-button
                            size="small"
                            plain
                            type="primary"
                            :disabled="!canUpdateSettings"
                            @click.stop="openPriceContactDialog(row, $index)"
                          >
                            编辑
                          </el-button>
                          <el-button
                            size="small"
                            plain
                            type="danger"
                            :disabled="!canUpdateSettings"
                            @click.stop="removePriceContact($index)"
                          >
                            删除
                          </el-button>
                          <el-button
                            size="small"
                            plain
                            type="info"
                            :disabled="!canUpdateSettings || $index === 0"
                            @click.stop="movePriceContact($index, -1)"
                          >
                            上移
                          </el-button>
                          <el-button
                            size="small"
                            plain
                            type="info"
                            :disabled="!canUpdateSettings || $index === priceContactsEditor.length - 1"
                            @click.stop="movePriceContact($index, 1)"
                          >
                            下移
                          </el-button>
                        </div>
                      </template>
                    </el-table-column>
                  </el-table>
                  <DataEmptyState
                    v-if="!priceContactsEditor.length"
                    description="暂无报价联系人"
                  />
                </div>
                <div class="price-watermark-settings">
                  <div class="card-header-with-action">
                    <h3 class="section-subtitle">
                      <i class="fas fa-stamp" />报价图片水印
                    </h3>
                    <el-button
                      v-if="canViewField('system_info.operations')"
                      type="primary"
                      size="small"
                      :loading="isLoading"
                      :disabled="!canUpdateSettings"
                      @click="saveSiteSettings"
                    >
                      <i class="fas fa-save" /><span>保存报价设置</span>
                    </el-button>
                  </div>
                  <el-form
                    label-position="top"
                    class="price-watermark-form"
                  >
                    <el-form-item label="水印文字">
                      <el-input
                        v-model="siteSettings.publicPriceWatermark"
                        :disabled="!canUpdateSettings"
                        placeholder="请输入公开报价水印文字"
                      />
                    </el-form-item>
                    <el-form-item label="显示水印">
                      <el-switch
                        v-model="siteSettings.publicPriceWatermarkEnabled"
                        active-value="1"
                        inactive-value="0"
                        :disabled="!canUpdateSettings"
                      />
                    </el-form-item>
                    <el-form-item label="显示时间">
                      <el-switch
                        v-model="siteSettings.publicPriceWatermarkTimeEnabled"
                        active-value="1"
                        inactive-value="0"
                        :disabled="!canUpdateSettings"
                      />
                    </el-form-item>
                    <el-form-item label="水印颜色">
                      <el-color-picker
                        v-model="siteSettings.publicPriceWatermarkColor"
                        :disabled="!canUpdateSettings"
                        show-alpha
                      />
                    </el-form-item>
                  </el-form>
                  <p class="form-help">
                    水印文字直接按最终显示内容填写；开启“显示时间”后会在文字末尾自动追加当前时间，颜色可单独设置。
                  </p>
                </div>

                <div class="price-watermark-settings setting-card price-query-card">
                  <div class="card-header-custom">
                    <div class="card-title">
                      <i class="fas fa-search-dollar" /><span>报价管理查询</span>
                    </div>
                  </div>
                  <div
                    v-if="canManageInventoryPasswords && canViewField('settings.passwords')"
                    class="password-list-section"
                  >
                    <div class="password-list-header">
                      <h4>查询密码</h4>
                      <el-button
                        type="primary"
                        size="small"
                        :icon="Plus"
                        @click="showAddPasswordDialog"
                      >
                        添加密码
                      </el-button>
                    </div>
                    <el-table
                      :data="loadingPasswords ? [] : inventoryPasswords"
                      border
                      stripe
                      class="data-table mobile-password-table"
                      style="width: 100%; margin-top: 12px;"
                    >
                      <template #empty>
                        <TableLoadingRow
                          v-if="loadingPasswords"
                          mode="block"
                          text="加载中..."
                        />
                        <DataEmptyState
                          v-else
                          description="暂无密码记录"
                        />
                      </template>
                      <el-table-column
                        v-if="canViewField('settings.passwords')"
                        prop="name"
                        label="用户名"
                        min-width="100"
                        class-name="complete-text-column"
                      />
                      <el-table-column
                        v-if="canViewField('settings.passwords')"
                        prop="password"
                        label="密码"
                        width="100"
                        align="center"
                      >
                        <template #default>
                          <span class="password-mask">******</span>
                        </template>
                      </el-table-column>
                      <el-table-column
                        v-if="canViewField('settings.passwords')"
                        prop="remarks"
                        label="备注"
                        min-width="100"
                        class-name="complete-text-column wrapped-text-column"
                      />
                      <el-table-column
                        v-if="canViewField('settings.passwords')"
                        prop="is_active"
                        label="状态"
                        width="80"
                        align="center"
                      >
                        <template #default="{ row }">
                          <el-tag
                            :type="row.is_active ? 'success' : 'info'"
                            size="small"
                          >
                            {{ row.is_active ? '启用' : '禁用' }}
                          </el-tag>
                        </template>
                      </el-table-column>
                      <el-table-column
                        v-if="canViewField('system_info.operations')"
                        label="操作"
                        :width="$getActionColumnWidth(1 + Number(canDeleteInventoryPasswords))"
                        align="center"
                        class-name="actions-column"
                      >
                        <template #default="{ row }">
                          <div class="action-buttons">
                            <el-button
                              type="primary"
                              size="small"
                              link
                              :icon="Edit"
                              @click.stop="editPassword(row)"
                            >
                              编辑
                            </el-button><el-button
                              v-if="canDeleteInventoryPasswords"
                              type="danger"
                              size="small"
                              link
                              :icon="Delete"
                              @click.stop="deletePassword(row.id)"
                            >
                              删除
                            </el-button>
                          </div>
                        </template>
                      </el-table-column>
                    </el-table>
                  </div>
                  <el-alert
                    v-else
                    title="需要系统设置编辑权限才能管理报价查询密码"
                    type="warning"
                    :closable="false"
                    show-icon
                  />
                </div>
              </div>
            </div>
          </div>

          <!-- 锁屏设置TAB -->
          <div
            v-if="activeTab === 'screenlock' && canViewField('screen_lock.config')"
            class="tab-panel tf-tab-panel"
          >
            <div class="screen-lock-settings-wrapper">
              <!-- 设置卡片组 -->
              <div class="settings-cards-group">
                <!-- 屏幕保护设置卡片 -->
                <div class="setting-card">
                  <div class="card-header-custom">
                    <div class="card-title">
                      <i class="fas fa-desktop" />
                      <span>屏幕保护设置</span>
                    </div>
                    <el-button
                      type="primary"
                      size="small"
                      :loading="isLoading"
                      :disabled="!canUpdateSettings"
                      @click="saveScreenLockSettings"
                    >
                      <span v-if="isLoading">保存中...</span>
                      <template v-else>
                        <i class="fas fa-save" />
                        <span>保存</span>
                      </template>
                    </el-button>
                  </div>

                  <el-alert
                    title="功能说明"
                    type="info"
                    show-icon
                    :closable="false"
                    style="margin-bottom: 20px;"
                  >
                    <p>• 点击顶部操作栏的"锁定"按钮即可锁定屏幕</p>
                    <p>• 解锁时需要输入您当前的登录密码</p>
                  </el-alert>

                  <el-form
                    ref="screenLockFormRef"
                    :model="screenLockSettings"
                    :disabled="!canUpdateSettings"
                    label-width="100px"
                    label-position="left"
                    class="screen-lock-form"
                  >
                    <!-- 背景类型 -->
                    <el-form-item label="背景类型">
                      <el-radio-group v-model="screenLockSettings.backgroundType">
                        <el-radio value="default">
                          默认背景
                        </el-radio>
                        <el-radio value="image">
                          图片背景
                        </el-radio>
                        <el-radio value="video">
                          视频背景
                        </el-radio>
                      </el-radio-group>
                    </el-form-item>

                    <!-- 图片背景 -->
                    <el-form-item
                      v-if="screenLockSettings.backgroundType === 'image'"
                      label="背景图片"
                    >
                      <div class="image-upload-container">
                        <div
                          v-if="screenLockSettings.imageUrl"
                          class="image-preview"
                        >
                          <Image
                            :src="screenLockSettings.imageUrl"
                            alt="背景图片"
                            mode="eager"
                          />
                          <el-button
                            type="danger"
                            size="small"
                            style="position: absolute; top: 8px; right: 8px"
                            @click="screenLockSettings.imageUrl = ''"
                          >
                            <i class="fas fa-times" />
                          </el-button>
                        </div>
                        <div
                          v-else
                          class="upload-placeholder"
                        >
                          <i class="fas fa-image" />
                          <span>暂无图片</span>
                        </div>
                        <el-input
                          v-model="screenLockSettings.imageUrl"
                          placeholder="输入图片URL或上传图片"
                          clearable
                        />
                      </div>
                      <div class="form-help">
                        支持 JPG、PNG 格式，建议尺寸 1920x1080，文件大小不超过 5MB
                      </div>
                    </el-form-item>

                    <!-- 视频背景 -->
                    <el-form-item
                      v-if="screenLockSettings.backgroundType === 'video'"
                      label="背景视频"
                    >
                      <div class="video-upload-container">
                        <div
                          v-if="screenLockSettings.videoUrl"
                          class="video-preview"
                        >
                          <video
                            :src="screenLockSettings.videoUrl"
                            muted
                            loop
                          />
                          <el-button
                            type="danger"
                            size="small"
                            style="position: absolute; top: 8px; right: 8px"
                            @click="screenLockSettings.videoUrl = ''"
                          >
                            <i class="fas fa-times" />
                          </el-button>
                        </div>
                        <div
                          v-else
                          class="upload-placeholder"
                        >
                          <i class="fas fa-video" />
                          <span>暂无视频</span>
                        </div>
                        <el-input
                          v-model="screenLockSettings.videoUrl"
                          placeholder="输入视频URL"
                          clearable
                        />
                      </div>
                      <div class="form-help">
                        支持 MP4、WebM 格式，建议时长 10-30 秒，文件大小不超过 50MB
                      </div>
                    </el-form-item>

                    <!-- 锁定信息 -->
                    <el-form-item label="锁定标题">
                      <el-input
                        v-model="screenLockSettings.title"
                        placeholder="屏幕已锁定"
                        maxlength="30"
                        show-word-limit
                      />
                    </el-form-item>

                    <el-form-item label="锁定提示">
                      <el-input
                        v-model="screenLockSettings.message"
                        type="textarea"
                        :rows="2"
                        placeholder="请输入密码解锁"
                        maxlength="100"
                        show-word-limit
                      />
                    </el-form-item>
                  </el-form>
                </div>
              </div>
            </div>
          </div>

          <!-- 预警配置TAB -->
          <div
            v-if="activeTab === 'warning' && canViewField('warning.config')"
            class="tab-panel tf-tab-panel"
          >
            <div class="phone-warning-config-wrapper">
              <PhoneWarningConfigView ref="warningConfigRef" />
            </div>
          </div>

          <div
            v-if="activeTab === 'returngoods' && canViewReturngoods && canViewField('returngoods.records')"
            class="tab-panel tf-tab-panel"
          >
            <Returngoods ref="returngoodsRef" />
          </div>
        </div>
      </div>

      <MobileDialog
        v-model="priceContactDialogVisible"
        :title="priceContactEditIndex === null ? '新增报价联系人' : '编辑报价联系人'"
        width="460px"
        :show-default-footer="false"
      >
        <el-form label-position="top">
          <el-form-item label="联系人姓名">
            <el-input
              v-model="priceContactForm.name"
              maxlength="50"
              clearable
              placeholder="请输入姓名或店铺名称"
            />
          </el-form-item>
          <el-form-item label="手机号码">
            <el-input
              v-model="priceContactForm.phone"
              maxlength="30"
              clearable
              placeholder="请输入手机号码"
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="priceContactDialogVisible = false">
            取消
          </el-button>
          <el-button
            type="primary"
            :disabled="!canUpdateSettings"
            @click="savePriceContact"
          >
            保存
          </el-button>
        </template>
      </MobileDialog>

      <!-- 添加/编辑密码对话框 -->
      <MobileDialog
        v-if="canViewField('settings.passwords')"
        v-model="passwordDialogVisible"
        :title="passwordDialogMode === 'add' ? '添加密码' : '编辑密码'"
        width="500px"
        :close-on-click-modal="false"
        dialog-class="system-password-dialog"
        :show-default-footer="false"
      >
        <el-form
          ref="passwordFormRef"
          :model="passwordForm"
          :rules="passwordFormRules"
          label-width="80px"
        >
          <el-form-item
            v-if="canViewField('settings.passwords')"
            label="用户名"
            prop="name"
          >
            <el-input
              v-model="passwordForm.name"
              placeholder="请输入用户名（如：张三、总店、广场店等）"
              clearable
            />
          </el-form-item>
          <el-form-item
            v-if="canViewField('settings.passwords')"
            label="密码"
            prop="password"
          >
            <el-input
              v-model="passwordForm.password"
              type="text"
              :placeholder="passwordDialogMode === 'edit' ? '留空表示不修改密码' : '请输入密码'"
              clearable
              show-password
            />
          </el-form-item>
          <el-form-item
            v-if="canViewField('settings.passwords')"
            label="备注"
            prop="remarks"
          >
            <el-input
              v-model="passwordForm.remarks"
              type="textarea"
              :rows="2"
              placeholder="请输入备注说明（可选）"
              clearable
            />
          </el-form-item>
          <el-form-item
            v-if="canViewField('settings.passwords')"
            label="状态"
            prop="is_active"
          >
            <el-switch
              v-model="passwordForm.is_active"
              active-text="启用"
              inactive-text="禁用"
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button
            type="default"
            @click="passwordDialogVisible = false"
          >
            取消
          </el-button>
          <el-button
            v-if="canViewField('system_info.operations')"
            type="primary"
            :loading="savingPassword"
            @click="savePassword"
          >
            {{ passwordDialogMode === 'add' ? '添加' : '保存' }}
          </el-button>
        </template>
      </MobileDialog>
    </PermissionGate>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import { Setting, Lock, Plus, Edit, Delete } from '@element-plus/icons-vue'
import { unifiedApi } from '@/utils/unified-api'
import { extractResponseData } from '@/utils/api-response'
import { useNotification } from '@/composables/useNotification'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import { useSiteSettingsStore } from '@/stores/siteSettings'
import { buildLogoUrl } from '@/utils/logoUtils'
import { PermissionGate, PageHeader } from '@/components/base'
import InlineLoading from '@/components/InlineLoading.vue'
import TableLoadingRow from '@/components/TableLoadingRow.vue'
import Image from '@/components/Image.vue'
import { ElMessageBox } from 'element-plus'
import type { FormInstance } from 'element-plus'
import { ValidationRules } from '@/composables'
import PhoneWarningConfigView from '@/views/system/phone-warning-config/PhoneWarningConfigView.vue'
import Returngoods from '@/views/system/page/Returngoods.vue'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { logger } from '@/utils/logger'
import { parsePublicPriceContacts } from '@/utils/publicPriceSettings'

const SITE_LOGO_ALLOWED_MIME_TYPES = {
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.png': ['image/png'],
  '.gif': ['image/gif'],
  '.ico': [
    'image/x-icon',
    'image/vnd.microsoft.icon',
    'application/vnd.microsoft.icon',
    'application/x-ico',
    'image/ico',
    'application/octet-stream'
  ]
} as const

const SITE_LOGO_ACCEPT = Object.keys(SITE_LOGO_ALLOWED_MIME_TYPES).join(',')
const SITE_LOGO_ALLOWED_EXTENSIONS = Object.keys(SITE_LOGO_ALLOWED_MIME_TYPES)
const SITE_LOGO_ALLOWED_LABEL = 'JPG、PNG、GIF、ICO'

const getSiteLogoFileExtension = (fileName: string) => {
  const extension = fileName.slice(fileName.lastIndexOf('.')).toLowerCase()
  return SITE_LOGO_ALLOWED_EXTENSIONS.includes(extension) ? extension : ''
}

const isValidSiteLogoMimeType = (extension: string, mimeType: string) => {
  if (!mimeType) {
    return true
  }

  const allowedMimeTypes = (SITE_LOGO_ALLOWED_MIME_TYPES[extension as keyof typeof SITE_LOGO_ALLOWED_MIME_TYPES] ?? []) as readonly string[]
  return allowedMimeTypes.includes(mimeType.toLowerCase())
}

// 路由和权限
const route = useRoute()
const siteSettingsStore = useSiteSettingsStore()
const { success, error, warning, loading } = useNotification()

// 权限检查 - 使用 usePagePermissions
const { canView, canEdit, canDelete } = usePagePermissions('settings')
const { canView: canViewReturngoods } = usePagePermissions('returngoods')
const canUpdateSettings = computed(() => canEdit.value)
const SYSTEM_MODULE_KEY = 'system'
const canViewField = (fieldKey: string) => fieldPermissions.isFieldVisible(SYSTEM_MODULE_KEY, fieldKey)
const canManageInventoryPasswords = computed(() => canEdit.value)
const canDeleteInventoryPasswords = computed(() => canDelete.value)

// 状态数据
const isLoading = ref(false)
const refreshing = ref(false)
const lastSavedTime = ref('')
const logoUploading = ref(false)
const siteLogoInputRef = ref<HTMLInputElement | null>(null)
const localSiteLogoPreviewUrl = ref('')
const warningConfigRef = ref<{
  openAddDialog: () => void
  loadConfigs: () => void
    } | null>(null)
const returngoodsRef = ref<{
  reload: () => void
    } | null>(null)

// TAB管理 - 支持从 URL 参数读取
const activeTab = ref((route.query.tab as string) || 'settings')

const openWarningTemplateDialog = () => {
  warningConfigRef.value?.openAddDialog()
}

// 刷新系统状态
const refreshSystemStatus = async () => {
  if (!canView.value) {
    return
  }

  if (refreshing.value) return

  refreshing.value = true
  try {
    unifiedApi.clearCache()
    await Promise.all([
      siteSettingsStore.loadSiteSettings(true),
      loadScreenLockSettings(),
      ...(activeTab.value === 'returngoods' ? [returngoodsRef.value?.reload?.()] : [])
    ])
    success('系统状态已刷新')
  } catch (err) {
    error('刷新失败')
  } finally {
    refreshing.value = false
  }
}

// 使用全局站点设置store
const siteSettings = computed(() => siteSettingsStore.settings)
const siteLogoPreviewUrl = computed(() => {
  if (localSiteLogoPreviewUrl.value) {
    return localSiteLogoPreviewUrl.value
  }

  return siteSettings.value.logoUrl ? buildLogoUrl(siteSettings.value.logoUrl) : ''
})

const clearLocalSiteLogoPreview = () => {
  if (localSiteLogoPreviewUrl.value.startsWith('blob:')) {
    URL.revokeObjectURL(localSiteLogoPreviewUrl.value)
  }

  localSiteLogoPreviewUrl.value = ''
}

const setLocalSiteLogoPreview = (file: File) => {
  clearLocalSiteLogoPreview()
  localSiteLogoPreviewUrl.value = URL.createObjectURL(file)
}

// 站点信息表格配置
const siteSettingsList = [
  {
    key: 'logoUrl',
    label: 'Logo 地址',
    category: 'basic',
    categoryLabel: '基本信息',
    type: 'input',
    icon: 'fas fa-image',
    placeholder: '/uploads/brand/brand_xxx.png'
  },
  // 基本信息
  {
    key: 'siteName',
    label: '网站名称',
    category: 'basic',
    categoryLabel: '基本信息',
    type: 'input',
    icon: 'fas fa-building',
    placeholder: '请输入网站名称'
  },
  {
    key: 'siteSubtitle',
    label: '站点副标题',
    category: 'basic',
    categoryLabel: '基本信息',
    type: 'input',
    icon: 'fas fa-quote-right',
    placeholder: '请输入站点副标题'
  },
  {
    key: 'siteDomain',
    label: '网站域名',
    category: 'basic',
    categoryLabel: '基本信息',
    type: 'input',
    icon: 'fas fa-globe',
    placeholder: '请输入网站域名'
  },
  {
    key: 'icpNumber',
    label: 'ICP备案号',
    category: 'basic',
    categoryLabel: '基本信息',
    type: 'input',
    icon: 'fas fa-certificate',
    placeholder: '请输入ICP备案号'
  },
  // 公司信息
  {
    key: 'companyName',
    label: '公司名称',
    category: 'company',
    categoryLabel: '公司信息',
    type: 'input',
    icon: 'fas fa-building',
    placeholder: '请输入公司名称'
  },
  {
    key: 'contactPhone',
    label: '联系电话',
    category: 'company',
    categoryLabel: '公司信息',
    type: 'input',
    icon: 'fas fa-phone',
    placeholder: '请输入联系电话'
  },
  {
    key: 'contactEmail',
    label: '联系邮箱',
    category: 'company',
    categoryLabel: '公司信息',
    type: 'input',
    icon: 'fas fa-envelope',
    placeholder: '请输入联系邮箱'
  },
  {
    key: 'companyAddress',
    label: '公司地址',
    category: 'company',
    categoryLabel: '公司信息',
    type: 'textarea',
    icon: 'fas fa-map-marker-alt',
    placeholder: '请输入公司地址'
  }
]

const visibleSiteSettingsList = computed(() => siteSettingsList.filter((item) => (
  item.key === 'logoUrl'
    ? canViewField('settings.logo')
    : canViewField('settings.site_info')
)))

const _priceSettingsList = [
  {
    key: 'publicPriceContacts',
    label: '公开报价联系方式',
    type: 'textarea',
    icon: 'fas fa-address-book',
    placeholder: '每行一条，格式：姓名|手机号'
  },
  {
    key: 'publicPriceWatermark',
    label: '报价图片水印文字',
    type: 'input',
    icon: 'fas fa-stamp',
    placeholder: '请输入公开报价水印文字'
  },
  {
    key: 'publicPriceWatermarkEnabled',
    label: '显示报价图片水印',
    type: 'switch',
    icon: 'fas fa-eye'
  },
  {
    key: 'publicPriceWatermarkTimeEnabled',
    label: '水印显示时间',
    type: 'switch',
    icon: 'fas fa-clock'
  }
]

const priceContactsEditor = ref<Array<{ name: string; phone: string }>>([])
const priceContactDialogVisible = ref(false)
const priceContactEditIndex = ref<number | null>(null)
const priceContactForm = reactive({ name: '', phone: '' })

const syncPriceContactsEditor = () => {
  priceContactsEditor.value = parsePublicPriceContacts(siteSettings.value.publicPriceContacts)
}

const openPriceContactDialog = (row?: { name: string; phone: string }, index?: number) => {
  if (!canUpdateSettings.value) return
  priceContactEditIndex.value = typeof index === 'number' ? index : null
  priceContactForm.name = row?.name || ''
  priceContactForm.phone = row?.phone || ''
  priceContactDialogVisible.value = true
}

const persistPriceContacts = async (previousValue?: string) => {
  const result = await siteSettingsStore.updateSiteSettings({
    publicPriceContacts: priceContactsEditor.value
      .map(contact => `${contact.name}|${contact.phone}`)
      .join('\n')
  })

  if (!result && previousValue !== undefined) {
    siteSettings.value.publicPriceContacts = previousValue
    syncPriceContactsEditor()
    return false
  }

  return Boolean(result)
}

const savePriceContact = async () => {
  const name = priceContactForm.name.trim()
  const phone = priceContactForm.phone.trim()
  if (!name || !phone) {
    error('请填写联系人姓名和手机号码')
    return
  }
  const previousValue = siteSettings.value.publicPriceContacts
  const item = { name, phone }
  if (priceContactEditIndex.value === null) priceContactsEditor.value.push(item)
  else priceContactsEditor.value.splice(priceContactEditIndex.value, 1, item)
  siteSettings.value.publicPriceContacts = priceContactsEditor.value.map(contact => `${contact.name}|${contact.phone}`).join('\n')
  if (!(await persistPriceContacts(previousValue))) return
  priceContactDialogVisible.value = false
}

const removePriceContact = async (index: number) => {
  if (!canUpdateSettings.value) return
  const confirmed = await ElMessageBox.confirm('确定删除这位报价联系人吗？', '删除确认', { type: 'warning' }).catch(() => false)
  if (!confirmed) return
  const previousValue = siteSettings.value.publicPriceContacts
  priceContactsEditor.value.splice(index, 1)
  siteSettings.value.publicPriceContacts = priceContactsEditor.value.map(contact => `${contact.name}|${contact.phone}`).join('\n')
  await persistPriceContacts(previousValue)
}

const movePriceContact = async (index: number, offset: number) => {
  const target = index + offset
  if (target < 0 || target >= priceContactsEditor.value.length) return
  const previousValue = siteSettings.value.publicPriceContacts
  const list = priceContactsEditor.value
  ;[list[index], list[target]] = [list[target], list[index]]
  siteSettings.value.publicPriceContacts = list.map(contact => `${contact.name}|${contact.phone}`).join('\n')
  await persistPriceContacts(previousValue)
}

// 锁屏设置
const screenLockSettings = reactive({
  backgroundType: 'default',
  imageUrl: '',
  videoUrl: '',
  title: '屏幕已锁定',
  message: '请输入密码解锁'
})

// 在库查询密码管理
const inventoryPasswords = ref<any[]>([])
const loadingPasswords = ref(false)
const passwordDialogVisible = ref(false)
const passwordDialogMode = ref<'add' | 'edit'>('add')
const passwordFormRef = ref<FormInstance>()
const savingPassword = ref(false)
const currentPasswordId = ref<number | null>(null)

const passwordForm = reactive({
  name: '',
  password: '',
  remarks: '',
  is_active: true
})

// 动态密码验证规则
const passwordFormRules = computed(() => ({
  name: [
    ValidationRules.required('请输入用户名')
  ],
  password: passwordDialogMode.value === 'add'
    ? [ValidationRules.required('请输入密码')]
    : []
}))

// 保存站点信息设置
const saveSiteSettings = async () => {
  if (!canUpdateSettings.value) {
    error('您没有修改系统设置的权限')
    return
  }

  const closeLoading = loading('正在保存设置...')

  try {
    // 联系人由独立列表维护，保存前序列化为站点设置中的统一文本格式。
    siteSettings.value.publicPriceContacts = priceContactsEditor.value
      .map(contact => `${contact.name}|${contact.phone}`)
      .join('\n')
    // 保存站点设置
    const result = await siteSettingsStore.updateSiteSettings(siteSettings.value)

    if (result) {
      lastSavedTime.value = TimeUtil.nowFormatted(TIME_FORMATS.DATETIME)

      // 保存成功后立即重新加载站点设置以确保最新数据
      await siteSettingsStore.loadSiteSettings(true)
      syncPriceContactsEditor()

      if (result.unsupportedFields?.length) {
        warning(`以下字段当前未写入数据库：${result.unsupportedFields.join('、')}`)
      } else {
        success('站点信息保存成功')
      }
    } else {
      throw new Error('保存失败')
    }
  } catch (err: any) {
    logger.error('保存设置失败:', err)
    error(`设置保存失败: ${err.message || '未知错误'}`)
  } finally {
    closeLoading()
  }
}

const triggerSiteLogoUpload = () => {
  if (logoUploading.value) {
    return
  }

  if (!canUpdateSettings.value) {
    error('您没有修改系统设置的权限')
    return
  }

  siteLogoInputRef.value?.click()
}

const resetSiteLogoInput = () => {
  if (siteLogoInputRef.value) {
    siteLogoInputRef.value.value = ''
  }
}

const handleSiteLogoFileChange = async (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]

  if (!file) {
    return
  }

  const extension = getSiteLogoFileExtension(file.name)
  if (!extension) {
    error(`仅支持 ${SITE_LOGO_ALLOWED_LABEL} 格式`)
    resetSiteLogoInput()
    return
  }

  if (!isValidSiteLogoMimeType(extension, file.type)) {
    error(`文件类型校验失败，仅支持 ${SITE_LOGO_ALLOWED_LABEL} 格式`)
    resetSiteLogoInput()
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    error('Logo 文件不能超过 5MB')
    resetSiteLogoInput()
    return
  }

  setLocalSiteLogoPreview(file)

  const formData = new FormData()
  formData.append('image', file)

  logoUploading.value = true
  const closeLoading = loading('正在上传Logo...')

  try {
    const response = await unifiedApi.upload('/system/upload-brand-image', formData)
    if (!response.success || !response.data?.url) {
      throw new Error(response.message || '上传失败')
    }

    siteSettingsStore.settings.logoUrl = response.data.url
    await siteSettingsStore.loadSiteSettings(true)
    clearLocalSiteLogoPreview()
    success('Logo上传成功')
  } catch (err: any) {
    logger.error('上传站点Logo失败:', err)
    clearLocalSiteLogoPreview()
    error(err?.message || 'Logo上传失败')
  } finally {
    logoUploading.value = false
    resetSiteLogoInput()
    closeLoading()
  }
}

const clearSiteLogo = async () => {
  if (!canUpdateSettings.value) {
    error('您没有修改系统设置的权限')
    return
  }

  try {
    await ElMessageBox.confirm(
      '确定要清空当前站点 Logo 吗？',
      '清空 Logo',
      {
        type: 'warning',
        confirmButtonText: '确定',
        cancelButtonText: '取消'
      }
    )

    const closeLoading = loading('正在清空Logo...')
    try {
      clearLocalSiteLogoPreview()
      const result = await siteSettingsStore.updateSiteSettings({
        ...siteSettings.value,
        logoUrl: ''
      })

      if (!result) {
        throw new Error('清空失败')
      }

      await siteSettingsStore.loadSiteSettings(true)
      success('Logo已清空')
    } finally {
      closeLoading()
    }
  } catch (err: any) {
    if (err === 'cancel' || err === 'close' || err?.message === 'cancel') {
      return
    }
    logger.error('清空站点Logo失败:', err)
    error(err?.message || '清空Logo失败')
  }
}

// 加载锁屏设置
const loadScreenLockSettings = async () => {
  try {
    const response = await unifiedApi.get('/screen-lock')
    if (response.success && response.data) {
      Object.assign(screenLockSettings, response.data)
    }
  } catch (error) {
    logger.error('加载锁屏设置失败:', error)
  }
}

// 保存锁屏设置
const saveScreenLockSettings = async () => {
  if (!canUpdateSettings.value) {
    error('您没有修改锁屏设置的权限')
    return
  }

  const closeLoading = loading('正在保存锁屏设置...')

  try {
    const response = await unifiedApi.post('/screen-lock', screenLockSettings)

    if (response.success) {
      lastSavedTime.value = TimeUtil.nowFormatted(TIME_FORMATS.DATETIME)
      success('锁屏设置保存成功')
    } else {
      throw new Error(response.message || '保存失败')
    }
  } catch (err) {
    logger.error('保存锁屏设置失败:', err)
    error(`保存失败：${err.message || '未知错误'}`)
  } finally {
    closeLoading()
  }
}

// 加载在库查询密码列表
const loadInventoryPasswords = async () => {
  if (!canManageInventoryPasswords.value) {
    inventoryPasswords.value = []
    return
  }

  loadingPasswords.value = true
  try {
    const response = await unifiedApi.get('/screen-lock/query-users')
    if (response.success) {
      // 后端返回 { success: true, data: { total: N, data: [...] } }
      inventoryPasswords.value = extractResponseData<any[]>(response)
    } else {
      logger.warn('⚠️ 密码列表响应格式异常:', response)
    }
  } catch (err) {
    logger.error('❌ 加载密码列表失败:', err)
  } finally {
    loadingPasswords.value = false
  }
}

// 显示添加密码对话框
const showAddPasswordDialog = () => {
  if (!canManageInventoryPasswords.value) {
    error('您没有管理批发报价查询密码的权限')
    return
  }

  passwordDialogMode.value = 'add'
  currentPasswordId.value = null
  Object.assign(passwordForm, {
    name: '',
    password: '',
    remarks: '',
    is_active: true
  })
  passwordDialogVisible.value = true
}

// 编辑密码
const editPassword = (row: any) => {
  if (!canManageInventoryPasswords.value) {
    error('您没有管理批发报价查询密码的权限')
    return
  }

  passwordDialogMode.value = 'edit'
  currentPasswordId.value = row.id
  Object.assign(passwordForm, {
    name: row.name,
    password: '', // 编辑时密码为空，留空表示不修改密码
    remarks: row.remarks || '',
    is_active: row.is_active === 1 || row.is_active === true // 确保转换为布尔值
  })
  passwordDialogVisible.value = true
}

// 保存密码
const savePassword = async () => {
  if (savingPassword.value) return

  if (!canManageInventoryPasswords.value) {
    error('您没有管理批发报价查询密码的权限')
    return
  }

  if (!passwordFormRef.value) return

  await passwordFormRef.value.validate(async (valid) => {
    if (!valid) return

    savingPassword.value = true
    try {
      if (passwordDialogMode.value === 'add') {
        await unifiedApi.post('/screen-lock/query-users', passwordForm)
        success('用户添加成功')
      } else {
        await unifiedApi.put(`/screen-lock/query-users/${currentPasswordId.value}`, passwordForm)
        success('用户更新成功')
      }
      passwordDialogVisible.value = false
      await loadInventoryPasswords()
    } catch (err) {
      error(`保存失败：${err.message || '未知错误'}`)
    } finally {
      savingPassword.value = false
    }
  })
}

// 删除密码
const deletePassword = async (id: number) => {
  if (!canDeleteInventoryPasswords.value) {
    error('您没有删除批发报价查询密码的权限')
    return
  }

  try {
    await ElMessageBox.confirm('确定要删除这个密码吗？', '提示', {
      confirmButtonText: '确定',
      cancelButtonText: '取消',
      type: 'warning'
    })

    await unifiedApi.delete(`/screen-lock/query-users/${id}`)
    success('删除成功')
    await loadInventoryPasswords()
  } catch (err) {
    if (err !== 'cancel') {
      error(`删除失败：${err.message || '未知错误'}`)
    }
  }
}

// 处理键盘快捷键
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.ctrlKey || event.metaKey) {
    switch (event.key) {
    case 's':
      event.preventDefault()
      saveSiteSettings()
      break
    }
  }
}

// 生命周期
onMounted(async () => {
  await fieldPermissions.init()
  // 初始化数据
  if (canView.value) {
    try {
      if (activeTab.value === 'returngoods' && !canViewReturngoods.value) {
        activeTab.value = 'settings'
      }

      // 加载数据
      await Promise.all([
        siteSettingsStore.loadSiteSettings(true), // 强制重新加载站点设置
        loadScreenLockSettings(), // 加载锁屏设置
        ...(canManageInventoryPasswords.value ? [loadInventoryPasswords()] : [])
      ])
      syncPriceContactsEditor()
    } catch (err) {
      logger.error('系统管理页面初始化失败:', err)
    }
  }

  // 添加键盘事件监听
  window.addEventListener('keydown', handleKeyDown)
})

onBeforeUnmount(() => {
  clearLocalSiteLogoPreview()
  window.removeEventListener('keydown', handleKeyDown)
})
</script>

<style scoped>
.system-management {
  padding: 24px;
  background: var(--bg-primary, var(--tf-color-surface));
  min-height: 100vh;
}

/* 系统容器 */
.system-container {
  background: transparent;
}

/* 站点信息设置部分 */
.system-settings-section {
  margin-bottom: 0;
}

/* 站点信息展示卡片 */
.site-settings-cards {
  margin-bottom: 32px;
}

/* 站点设置行容器 - PC端一行展示 */
.site-settings-row {
  display: grid;
  grid-template-columns: 400px 1fr;
  gap: 24px;
  margin-bottom: 24px;
}

/* 响应式：当屏幕较小时改为单列 */
@media (max-width: 1400px) {
  .site-settings-row {
    grid-template-columns: 350px 1fr;
  }
}

@media (max-width: 1200px) {
  .site-settings-row {
    grid-template-columns: 1fr;
  }
}

.site-logo-panel {
  padding: 24px;
  border-radius: 12px;
  background: var(--color-bg-white);
  border: 1px solid var(--border-light, var(--tf-color-border-muted));
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

/* 卡片头部带操作按钮 */
.card-header-with-action {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 2px solid var(--bg-tertiary, var(--tf-color-surface-muted));
}

.card-header-with-action .card-title,
.card-header-with-action .section-subtitle {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, var(--tf-color-heading));
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-header-with-action .card-title i,
.card-header-with-action .section-subtitle i {
  color: var(--primary-color, var(--tf-color-indigo-brand));
}

.site-logo-preview-card {
  display: flex;
  position: relative;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: 20px;
  border-radius: 12px;
  border: 1px dashed var(--tf-color-border-blue-light);
  background: linear-gradient(180deg, var(--tf-color-surface-blue) 0%, var(--tf-color-surface-cool-soft) 100%);
}

.site-logo-preview-card.clickable {
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
}

.site-logo-preview-card.clickable:hover,
.site-logo-preview-card.clickable:focus-visible {
  border-color: var(--primary-color, var(--tf-color-indigo-brand));
  box-shadow: 0 6px 18px rgba(102, 126, 234, 0.16);
  transform: translateY(-1px);
  outline: none;
}

.site-logo-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.site-logo-preview img {
  max-width: 100%;
  max-height: 120px;
  object-fit: contain;
}

.site-logo-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-muted, var(--text-muted));
}

.site-logo-empty i {
  font-size: 30px;
  color: var(--tf-color-gray-chakra-400);
}

.site-logo-preview-tip {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: 12px;
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(44, 62, 80, 0.72);
  color: var(--color-bg-white);
  font-size: 12px;
  line-height: 1.4;
  text-align: center;
  pointer-events: none;
}

.site-logo-editor {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 16px;
  min-width: 0;
}

.logo-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.logo-editor-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, var(--tf-color-heading));
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-editor-header h3 i {
  color: var(--primary-color, var(--tf-color-indigo-brand));
}

.logo-editor-tip {
  margin: 0;
  font-size: 14px;
  line-height: 1.7;
  color: var(--text-secondary, var(--tf-color-muted));
}

.site-logo-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.logo-editor-help {
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-muted, var(--text-muted));
}

.site-logo-hidden-input {
  display: none;
}

.settings-card-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 20px;
}

.settings-card-row:last-child {
  margin-bottom: 0;
}

.settings-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--border-light, var(--tf-color-border-muted));
  display: flex;
  align-items: center;
  gap: 16px;
  transition: all 0.3s ease;
}

.settings-card:hover {
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.settings-card .card-icon {
  width: 50px;
  height: 50px;
  border-radius: 10px;
  background: linear-gradient(135deg, var(--tf-color-indigo-brand) 0%, var(--tf-color-purple-brand) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.settings-card .card-icon i {
  font-size: 20px;
  color: white;
}

.settings-card .card-content {
  flex: 1;
  min-width: 0;
}

.settings-card .card-content h4 {
  margin: 0 0 6px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary, var(--tf-color-muted));
}

.settings-card .card-content p {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary, var(--tf-color-heading));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.section-subtitle {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, var(--tf-color-heading));
  display: flex;
  align-items: center;
  gap: 8px;
}

.section-subtitle i {
  color: var(--primary-color, var(--tf-color-indigo-brand));
}

/* 移除旧的section-header样式，已不再使用 */

/* 站点信息表格 */
.site-settings-table {
  background: white;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  padding: 24px;
  max-width: 900px;
}

.site-settings-table :deep(.el-input__wrapper) {
  border-radius: 6px;
}

.site-settings-table :deep(.el-input__inner) {
  border: 1px solid var(--border-light, var(--tf-color-border-muted));
}

.site-settings-table :deep(.el-textarea__inner) {
  border-radius: 6px;
  border: 1px solid var(--border-light, var(--tf-color-border-muted));
}

.text-muted {
  color: var(--text-muted, var(--text-muted));
  font-size: 13px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.section-header h2 {
  margin: 0;
  font-size: 20px;
  color: var(--text-primary, var(--tf-color-heading));
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 12px;
}

.section-header h2 i {
  color: var(--primary-color, var(--tf-color-indigo-brand));
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .system-management {
    padding: 16px;
  }

  /* 站点信息卡片响应式 */
  .site-logo-panel {
    grid-template-columns: 1fr;
    padding: 16px;
    gap: 16px;
  }

  .site-logo-preview-card {
    min-height: 160px;
    padding: 16px;
  }

  .site-logo-preview img {
    max-height: 88px;
  }

  .logo-editor-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .site-logo-actions {
    width: 100%;
  }

  .site-logo-actions :deep(.el-button) {
    flex: 1 1 calc(50% - 5px);
    min-width: 0;
  }

  .settings-card-row {
    grid-template-columns: 1fr;
    gap: 16px;
  }

  .settings-card {
    padding: 16px;
  }

  .settings-card .card-icon {
    width: 40px;
    height: 40px;
  }

  .settings-card .card-icon i {
    font-size: 16px;
  }

  .settings-card .card-content h4 {
    font-size: 13px;
  }

  .settings-card .card-content p {
    font-size: 14px;
  }

  /* 站点信息表格响应式 */
  .site-settings-table {
    padding: 16px;
  }

  .section-subtitle {
    font-size: 14px;
  }
}

/* 报价配置：PC端联系人与报价查询并排，水印设置占满下一行；移动端自动单列。 */
.price-config-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}

.price-contact-card,
.price-query-card,
.price-config-grid > .price-watermark-settings {
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.price-watermark-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  column-gap: 16px;
}

.price-watermark-form .el-form-item:first-child {
  grid-column: 1 / -1;
}

@media (max-width: 480px) {
  .price-watermark-form {
    grid-template-columns: 1fr;
  }

  .price-watermark-form .el-form-item:first-child {
    grid-column: auto;
  }
}

@media (max-width: 900px) {
  .price-config-grid {
    grid-template-columns: 1fr;
  }

  .price-config-grid > .price-watermark-settings {
    grid-column: auto;
  }
}

@media (max-width: 480px) {
  .site-logo-actions :deep(.el-button) {
    width: 100%;
    flex-basis: 100%;
  }
}

/* 按钮样式 */
/* 锁屏设置样式 */
.screen-lock-settings-wrapper {
  background: transparent;
  padding: 0;
}

/* 设置卡片组 */
.settings-cards-group {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 24px;
}

.setting-card {
  background: white;
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 2px 16px rgba(0, 0, 0, 0.08);
  border: 1px solid var(--border-light, var(--tf-color-border-muted));
  transition: all 0.3s ease;
}

.setting-card:hover {
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.12);
}

.card-header-custom {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 2px solid var(--bg-tertiary, var(--tf-color-surface-muted));
}

.card-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, var(--tf-color-heading));
  margin: 0;
}

.card-title i {
  font-size: 20px;
  color: var(--primary-color, var(--tf-color-indigo-brand));
}

/* 功能演示框 */
.demo-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 20px;
  background: linear-gradient(135deg, var(--tf-color-surface-muted) 0%, var(--tf-color-border-muted) 100%);
  border-radius: 12px;
}

.demo-step {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  width: 100%;
  max-width: 320px;
}

.step-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--tf-color-indigo-brand) 0%, var(--tf-color-purple-brand) 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  flex-shrink: 0;
}

.step-text {
  font-size: 14px;
  color: var(--text-primary, var(--tf-color-heading));
}

.demo-arrow {
  font-size: 20px;
  color: var(--primary-color, var(--tf-color-indigo-brand));
  margin: 4px 0;
}

.screen-lock-form {
  max-width: 800px;
}

.screen-lock-form :deep(.el-form-item__content) {
  min-width: 0;
}

.screen-lock-form :deep(.el-form-item) {
  margin-bottom: 24px;
}

.screen-lock-form :deep(.el-form-item__label) {
  font-weight: 500;
  color: var(--text-primary, var(--tf-color-heading));
}

.image-upload-container,
.video-upload-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.image-preview,
.video-preview {
  width: 100%;
  max-width: 400px;
  height: 240px;
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  border: 2px solid var(--border-light, var(--tf-color-border-muted));
}

.image-preview img,
.video-preview video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.upload-placeholder {
  width: 100%;
  max-width: 400px;
  height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: var(--text-muted, var(--text-muted));
  background: var(--bg-tertiary, var(--tf-color-surface-muted));
  border: 2px dashed var(--border-light, var(--tf-color-border-muted));
  border-radius: 8px;
}

.upload-placeholder i {
  font-size: 48px;
  margin-bottom: 12px;
  color: var(--text-secondary, var(--tf-color-muted));
}

.upload-placeholder span {
  font-size: 14px;
}

.form-help {
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-muted, var(--text-muted));
  line-height: 1.5;
}

/* 密码列表样式 */
.password-list-section {
  margin-top: 24px;
}

.password-list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.password-list-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, var(--tf-color-heading));
}

.password-mask {
  color: var(--text-muted, var(--text-muted));
  font-family: monospace;
  letter-spacing: 2px;
}

/* 操作按钮样式 */
.action-buttons {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: nowrap;
}

/* 响应式设计 - 锁屏设置 */
@media (max-width: 768px) {
  .screen-lock-settings-wrapper {
    width: 100%;
    overflow: hidden;
  }

  .settings-cards-group {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
    width: 100%;
  }

  .setting-card {
    min-width: 0;
    padding: 14px;
    border-radius: 14px;
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.07);
  }

  .card-header-custom {
    flex-direction: row;
    align-items: center;
    gap: 10px;
    margin-bottom: 14px;
    padding-bottom: 12px;
  }

  .card-title {
    min-width: 0;
    gap: 8px;
    font-size: 15px;
    line-height: 1.25;
  }

  .card-title i {
    font-size: 16px;
  }

  .card-header-custom .el-button {
    width: auto;
    flex: 0 0 auto;
    justify-content: center;
    padding: 8px 10px;
  }

  .screen-lock-settings-wrapper :deep(.el-alert) {
    margin-bottom: 14px !important;
    border-radius: 12px;
  }

  .screen-lock-settings-wrapper :deep(.el-alert__content) {
    min-width: 0;
  }

  .screen-lock-settings-wrapper :deep(.el-alert p) {
    margin: 3px 0;
    font-size: 12px;
    line-height: 1.45;
  }

  .demo-step {
    padding: 10px 16px;
    max-width: 100%;
  }

  .step-text {
    font-size: 13px;
  }

  .image-preview,
  .video-preview,
  .upload-placeholder {
    max-width: 100%;
    height: 150px;
    border-radius: 12px;
  }

  .screen-lock-form {
    max-width: 100%;
  }

  .screen-lock-form :deep(.el-form-item__label) {
    width: 100% !important;
    text-align: left !important;
  }

  .screen-lock-settings-wrapper :deep(.el-form) {
    width: 100%;
  }

  .screen-lock-settings-wrapper :deep(.el-form-item) {
    display: block;
    margin-bottom: 16px;
  }

  .screen-lock-settings-wrapper :deep(.el-form-item__label) {
    width: 100% !important;
    margin-bottom: 8px;
    padding: 0 !important;
    line-height: 1.4;
    font-size: 13px;
    font-weight: 700;
    text-align: left !important;
  }

  .screen-lock-settings-wrapper :deep(.el-form-item__content) {
    width: 100%;
    margin-left: 0 !important;
    min-width: 0;
  }

  .screen-lock-settings-wrapper :deep(.el-radio-group) {
    display: grid;
    grid-template-columns: 1fr;
    align-items: stretch;
    gap: 8px;
    width: 100%;
  }

  .screen-lock-settings-wrapper :deep(.el-radio) {
    margin-right: 0;
    height: auto;
    min-height: 38px;
    padding: 9px 10px;
    border: 1px solid var(--border-light, var(--tf-color-border-muted));
    border-radius: 12px;
    background: rgba(248, 250, 252, 0.9);
  }

  .screen-lock-settings-wrapper :deep(.el-radio__label) {
    font-size: 13px;
    line-height: 1.3;
  }

  .screen-lock-settings-wrapper :deep(.el-input),
  .screen-lock-settings-wrapper :deep(.el-textarea) {
    width: 100%;
  }

  .image-upload-container,
  .video-upload-container {
    gap: 10px;
    width: 100%;
    min-width: 0;
  }

  .upload-placeholder i {
    margin-bottom: 8px;
    font-size: 30px;
  }

  .upload-placeholder span,
  .form-help {
    font-size: 12px;
  }

  .form-help {
    margin-top: 6px;
  }

  .password-list-section {
    margin-top: 4px;
  }

  .screen-lock-settings-wrapper .password-list-header {
    flex-direction: row;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .screen-lock-settings-wrapper .password-list-header h4 {
    font-size: 15px;
  }

  .screen-lock-settings-wrapper .password-list-header .el-button {
    width: auto;
    flex: 0 0 auto;
  }

  .screen-lock-settings-wrapper .action-buttons {
    justify-content: flex-end;
  }

  .screen-lock-settings-wrapper :deep(.mobile-password-table) {
    display: block;
    width: 100% !important;
    overflow-x: auto;
    font-size: 12px;
    border-radius: 12px;
    -webkit-overflow-scrolling: touch;
  }

  .screen-lock-settings-wrapper :deep(.mobile-password-table .el-table__inner-wrapper) {
    min-width: 520px;
  }

  .screen-lock-settings-wrapper :deep(.mobile-password-table .cell) {
    padding-left: 6px;
    padding-right: 6px;
    white-space: nowrap;
  }

  :global(.system-password-dialog .el-form) {
    width: 100%;
  }

  :global(.system-password-dialog .el-form-item) {
    display: block;
    margin-bottom: 16px;
  }

  :global(.system-password-dialog .el-form-item__label) {
    width: 100% !important;
    margin-bottom: 8px;
    padding: 0 !important;
    text-align: left !important;
    font-size: 13px;
    font-weight: 700;
  }

  :global(.system-password-dialog .el-form-item__content) {
    margin-left: 0 !important;
    width: 100%;
  }

  :global(.system-password-dialog .el-input),
  :global(.system-password-dialog .el-textarea) {
    width: 100%;
  }

  .phone-warning-config-wrapper {
    background: transparent;
    padding: 0;
    height: calc(100vh - 200px);
    min-height: 600px;

    .warning-config-iframe {
      width: 100%;
      height: 100%;
      border: none;
      background: var(--bg-primary, var(--tf-color-surface));
      border-radius: 8px;
    }
  }
}

@media (max-width: 480px) {
  .setting-card {
    padding: 12px;
    border-radius: 12px;
  }

  .card-header-custom {
    align-items: flex-start;
  }

  .card-header-custom .el-button span {
    display: none;
  }

  .image-preview,
  .video-preview,
  .upload-placeholder {
    height: 132px;
  }

  .screen-lock-settings-wrapper .password-list-header {
    align-items: stretch;
    flex-direction: column;
  }

  .screen-lock-settings-wrapper .password-list-header .el-button {
    width: 100%;
  }

  .screen-lock-settings-wrapper :deep(.mobile-password-table .el-table__inner-wrapper) {
    min-width: 500px;
  }
}
</style>
