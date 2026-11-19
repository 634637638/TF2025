<!--
  AccessoryStockInModal - 商品入库/编辑模态框

  功能描述：
  - 商品入库：按商品名称搜索模板或列表行内补货
  - 商品模版编辑：修改模板共享资料
  - 商品库存编辑：选择原入库批次，复用入库字段更正数量、成本、供应商等资料
  - 支持图片上传
  - 同一模板支持数量与SN批次入库，归属本次所选店铺
  - 现代化UI设计，响应式布局

  API接口：
  - GET /accessories/barcode/:barcode - 根据条码查询配件
  - POST /accessories/stock-in - 配件入库
  - PUT /accessories/:id - 更新配件
  - GET /accessories/:id/stock-in-options - 查询原入库批次
  - GET /accessories/stock-in/:id/edit - 核验并读取原入库资料
  - POST /accessories/stock-in/:id/corrections - 保留原单并生成关联替代批次
  - GET /accessories/options - 公共资料、商品类型及按品牌适配型号
-->
<template>
  <MobileDialog
    v-model="visible"
    :title="isCorrectionMode ? '编辑商品库存' : props.profileEditOnly ? '编辑商品档案' : isEditMode ? '编辑商品模板' : props.archiveOnly ? '商品模板' : '商品入库'"
    :close-on-click-modal="false"
    :close-on-press-escape="!submitting"
    :show-close="!submitting"
    dialog-class="crud-dialog-lg accessory-dialog tf-dialog-body-flush"
    :show-default-footer="false"
    destroy-on-close
    @close="handleDialogClose"
  >
    <div
      class="dialog-body"
      :class="{ 'template-editor': props.archiveOnly || isEditMode }"
    >
      <div
        v-if="isCorrectionMode"
        class="tf-query-modal-section"
      >
        <el-form
          label-position="top"
          class="tf-dialog-form tf-dialog-form--stacked tf-form-layout tf-form-grid"
          :disabled="submitting || !!pendingCorrection"
          @submit.prevent
        >
          <el-form-item
            label="历史入库批次"
            class="tf-form-field--wide tf-form-field--inline"
          >
            <el-select
              v-model="selectedPurchaseId"
              aria-label="选择历史入库批次"
              placeholder="选择需要更正的入库批次"
              :loading="correctionOptionsLoading"
              @change="loadCorrectionContext"
            >
              <el-option
                v-for="batch in correctionOptions"
                :key="batch.purchase_id"
                :value="batch.purchase_id"
                :label="correctionOptionLabel(batch)"
              />
            </el-select>
          </el-form-item>
        </el-form>
        <Pagination
          v-if="correctionTotal > 20"
          :current="correctionPage"
          :page-size="20"
          :total="correctionTotal"
          :disabled="correctionOptionsLoading || submitting || !!pendingCorrection"
          :show-page-sizes="false"
          @change="changeCorrectionPage"
        />
        <SectionLoading
          v-if="correctionOptionsLoading || correctionLoading"
          size="compact"
          text="正在读取历史入库批次..."
        />
        <el-alert
          v-else-if="correctionError"
          :title="correctionError"
          type="error"
          :closable="false"
        />
        <el-alert
          v-else
          :title="pendingCorrection ? '更正结果尚未确认，请重试原更正核对；系统不会重复调整库存。' : '选择原入库批次后更正资料；保存会保留原单并关联替代批次。已有销售、划拨或付款记录时须先处理关联业务。'"
          type="info"
          :closable="false"
        />
      </div>
      <SectionLoading
        v-if="isStockInMode && pendingStockIn && submitting"
        text="正在提交并核对入库结果，请稍候..."
      />
      <el-alert
        v-else-if="isStockInMode && pendingStockIn"
        type="warning"
        :closable="false"
        title="上次入库结果尚未确认，请重试原入库；系统会核对原采购，不会重复入库。确认前暂不能新增另一笔。"
      />
      <el-alert
        v-if="isStockInMode && recoveryError"
        type="error"
        :closable="false"
        :title="recoveryError"
      />
      <div
        v-if="props.profileEditOnly && props.accessory"
        class="profile-correction-preview"
        aria-label="商品档案修改前后对照"
      >
        <div class="profile-correction-preview__header">
          <strong>字段</strong><strong>修改前</strong><strong>修改后</strong>
        </div>
        <div
          v-for="row in profileCorrectionRows"
          :key="row.label"
          class="profile-correction-preview__row"
        >
          <strong>{{ row.label }}</strong><span>{{ row.before || '-' }}</span><span>{{ row.after || '-' }}</span>
        </div>
      </div>
      <el-form
        v-if="(!isStockInMode || !pendingStockIn) && (!isCorrectionMode || (!!correctionContext && !correctionOptionsLoading && !correctionLoading && !pendingCorrection))"
        ref="formRef"
        :model="formData"
        :rules="formRules"
        :disabled="submitting"
        label-position="top"
        class="accessory-form tf-dialog-form tf-dialog-form--stacked tf-form-layout tf-form-grid"
      >
        <div class="tf-query-modal-section">
          <div
            class="tf-query-modal-section-title"
            role="heading"
            aria-level="3"
          >
            <i class="fas fa-info-circle" />
            <span>
              基本信息
            </span>
          </div>
          <el-alert
            v-if="stockTemplateColorsSummary && !isColorStockIn"
            :title="stockTemplateColorsSummary"
            type="info"
            :closable="false"
            aria-label="模板全部颜色规格"
          />
          <el-alert
            v-if="isEditMode && !props.accessory?.color_template_id && formData.color_variants.length > 1"
            :title="`现有商品保留为${getColorName(persistedTemplateColors[0]?.color_id || formData.color_variants[0].color_id)}，新增颜色分别管理库存。`"
            type="info"
            :closable="false"
          />
          <div>
            <el-row :gutter="16">
              <el-col
                v-for="field in basicFields"
                :key="field"
                :xs="field === 'inventory_time' ? 24 : 12"
                :sm="field === 'inventory_time' ? 24 : 12"
                :md="field === 'inventory_time' ? 12 : 6"
              >
                <el-form-item
                  v-if="field === 'name'"
                  label="商品名称"
                  prop="name"
                >
                  <el-select
                    v-if="isEntryMode"
                    ref="templateSelectRef"
                    :model-value="existingAccessory?.color_template_id || existingAccessory?.id"
                    placeholder="搜索商品名称"
                    aria-label="按商品名称选择模板"
                    filterable
                    remote
                    fit-input-width
                    popper-class="tf2025-form-popper"
                    :no-data-text="templateError || (templateKeyword ? '未找到匹配商品，请调整关键词' : '暂无可入库的商品模板')"
                    :disabled="isFixedTemplate"
                    :remote-method="searchTemplates"
                    :loading="templatesLoading || searching"
                    @visible-change="handleTemplateDropdown"
                    @popup-scroll="handleTemplateScroll"
                    @change="selectTemplate"
                  >
                    <el-option-group
                      v-for="group in templateGroups"
                      :key="group.name"
                      :label="group.name"
                    >
                      <el-option
                        v-for="item in group.items"
                        :key="item.id"
                        :label="getTemplateLabel(item)"
                        :value="item.id"
                      >
                        <div class="d-flex flex-column gap-1 w-full">
                          <strong>{{ getTemplateLabel(item) }}</strong>
                          <span
                            v-if="getTemplateDetails(item)"
                            class="text-secondary text-xs"
                          >{{ getTemplateDetails(item) }}</span>
                        </div>
                      </el-option>
                    </el-option-group>
                    <template #label>
                      {{ existingAccessory ? getTemplateLabel(existingAccessory) : '' }}
                    </template>
                    <template
                      v-if="!isFixedTemplate"
                      #footer
                    >
                      <div class="d-flex flex-wrap align-center justify-between gap-2">
                        <span class="text-secondary text-xs">
                          {{ templateError || `已显示 ${templateResults.length} / ${templateTotal}` }}
                        </span>
                        <el-button
                          v-if="templateError || templateHasMore"
                          link
                          type="primary"
                          :loading="templatesLoading"
                          :disabled="templatesLoading"
                          @click.stop="templateError ? loadTemplates(templateResults.length > 0) : loadMoreTemplates()"
                        >
                          {{ templateError ? '重试' : '加载更多' }}
                        </el-button>
                      </div>
                    </template>
                  </el-select>
                  <el-input
                    v-else
                    v-model="formData.name"
                    placeholder="请输入商品名称"
                    :disabled="isEntryMode || !!existingAccessory"
                  />
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'operator_name'"
                  label="入库员"
                >
                  <el-input
                    :model-value="isCorrectionMode ? correctionContext?.operator_name || '' : authStore.user?.name || authStore.user?.username || ''"
                    readonly
                  />
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'inventory_time'"
                  label="入库时间"
                  prop="inventory_time"
                >
                  <el-input
                    v-if="isCorrectionMode"
                    :model-value="formatDateTime(correctionContext?.inventory_time)"
                    aria-label="原入库时间"
                    readonly
                  />
                  <el-date-picker
                    v-else
                    v-model="formData.inventory_time"
                    type="datetime"
                    placeholder="请选择入库时间"
                    aria-label="入库时间（北京时间）"
                    :format="TIME_FORMATS.DATETIME"
                    :value-format="TIME_FORMATS.DATETIME"
                    :clearable="false"
                    popper-class="tf2025-form-popper"
                  />
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'distribution'"
                  label="店铺"
                  prop="store_id"
                >
                  <el-select
                    v-model="formData.store_id"
                    placeholder="选择入库店铺"
                    filterable
                    aria-label="入库店铺"
                  >
                    <el-option
                      v-for="store in stores"
                      :key="store.id"
                      :label="store.name"
                      :value="store.id"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'usage_type'"
                  label="入库用途"
                  prop="usage_type"
                  required
                >
                  <el-select
                    v-model="formData.usage_type"
                    aria-label="入库用途"
                  >
                    <el-option
                      label="收费"
                      value="sale"
                    />
                    <el-option
                      label="赠送"
                      value="gift"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'total_quantity'"
                  label="入库总数"
                  prop="total_quantity"
                >
                  <el-input-number
                    v-model="formData.total_quantity"
                    :min="1"
                    :max="999999"
                    :controls="false"
                    :precision="0"
                    aria-label="入库总数"
                  />
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'category'"
                  label="商品类型"
                >
                  <el-input
                    v-if="isEntryMode"
                    :model-value="formData.category || categories.find(item => item.id === formData.category_id)?.name || ''"
                    placeholder="选择商品后自动填充"
                    readonly
                  />
                  <el-select
                    v-else
                    v-model="formData.category_id"
                    placeholder="选择商品类型"
                    filterable
                    :disabled="!!existingAccessory"
                    clearable
                  >
                    <el-option
                      v-for="category in categories"
                      :key="category.id"
                      :label="category.name"
                      :value="Number(category.id)"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'model_brand'"
                  label="适配品牌"
                >
                  <el-select
                    v-model="modelBrandId"
                    placeholder="通用"
                    aria-label="适配品牌"
                    :disabled="!!existingAccessory"
                    clearable
                    filterable
                  >
                    <el-option
                      label="通用"
                      :value="0"
                    />
                    <el-option
                      v-for="brand in modelBrands"
                      :key="brand.id"
                      :label="brand.name"
                      :value="brand.id"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'model_name'"
                  label="适配型号"
                >
                  <el-select
                    v-model="formData.model_ids"
                    placeholder="通用"
                    aria-label="适配型号"
                    multiple
                    collapse-tags
                    collapse-tags-tooltip
                    clearable
                    filterable
                    :disabled="(!modelBrandId && !formData.model_ids.length) || !!existingAccessory"
                    :loading="modelsLoading"
                  >
                    <el-option
                      v-for="model in models"
                      :key="model.id"
                      :label="model.name"
                      :value="model.id"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'brand_name'"
                  label="配件品牌"
                >
                  <el-select
                    v-model="formData.brand_id"
                    placeholder="选择配件品牌"
                    clearable
                    filterable
                    @clear="formData.brand_id = null"
                  >
                    <el-option
                      v-for="brand in brands"
                      :key="brand.id"
                      :label="brand.name"
                      :value="brand.id"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'product_model'"
                  label="配件型号"
                >
                  <el-input
                    v-model="formData.product_model"
                    :disabled="isStockInMode && !!existingAccessory"
                    placeholder="厂家型号，可不填"
                    :maxlength="100"
                    clearable
                  />
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'color_name'"
                  label="颜色"
                >
                  <el-select
                    v-if="canManageColorVariants"
                    v-model="selectedTemplateColors"
                    multiple
                    collapse-tags
                    collapse-tags-tooltip
                    filterable
                    :clearable="!persistedTemplateColors.length"
                    placeholder="可多选颜色"
                    aria-label="模板颜色（多选）"
                  >
                    <el-option
                      v-for="color in colors"
                      :key="color.id"
                      :label="color.name"
                      :value="Number(color.id)"
                      :disabled="persistedTemplateColors.some(row => row.color_id === Number(color.id))"
                    />
                  </el-select>
                  <el-select
                    v-else-if="isCorrectionMode && existingAccessory?.color_variants?.length"
                    :model-value="selectedStockColor"
                    disabled
                    aria-label="原入库颜色"
                  >
                    <el-option
                      v-for="variant in existingAccessory.color_variants"
                      :key="variant.accessory_id"
                      :value="variant.accessory_id"
                      :label="[variant.color_name, canViewAccessoryField('barcode') ? variant.barcode : ''].filter(Boolean).join(' · ')"
                    />
                  </el-select>
                  <el-select
                    v-else
                    v-model="formData.color_id"
                    :disabled="!!existingAccessory || Boolean(props.accessory?.color_template_id)"
                    placeholder="选择颜色"
                    clearable
                    filterable
                  >
                    <el-option
                      v-for="color in colors"
                      :key="color.id"
                      :label="color.name"
                      :value="color.id"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'barcode'"
                  label="条形码"
                >
                  <el-input
                    :model-value="formData.barcode"
                    aria-label="商品条形码"
                    placeholder="未设置条形码"
                    readonly
                  />
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'unit'"
                  label="单位"
                >
                  <el-select
                    v-model="formData.unit_id"
                    placeholder="选择计量单位"
                    :disabled="!!existingAccessory"
                    clearable
                  >
                    <el-option
                      v-for="unit in units"
                      :key="unit.id"
                      :label="unit.name"
                      :value="Number(unit.id)"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'supplier_name'"
                  label="供应商"
                  prop="supplier_id"
                >
                  <el-select
                    v-model="formData.supplier_id"
                    placeholder="选择供应商"
                    clearable
                    filterable
                  >
                    <el-option
                      v-for="supplier in suppliers"
                      :key="supplier.id"
                      :label="supplier.name"
                      :value="supplier.id"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'purchase_cost'"
                  label="进价"
                  prop="purchase_cost"
                >
                  <AmountInput
                    v-model="formData.purchase_cost"
                    aria-label="入库进价"
                    :min="0"
                    :step="1"
                    class="full-width"
                  />
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'sale_price'"
                  :label="isEntryMode ? '销售价' : '零售价'"
                >
                  <el-input
                    v-if="isEntryMode"
                    :model-value="isRestocking ? formatAmount(formData.sale_price) : ''"
                    placeholder="读取模板售价"
                    readonly
                    aria-label="销售价"
                  />
                  <AmountInput
                    v-else
                    v-model="formData.sale_price"
                    :min="0"
                    :step="1"
                    class="full-width"
                  />
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'min_stock'"
                  label="预警值"
                >
                  <el-input-number
                    v-model="formData.min_stock"
                    :disabled="!!existingAccessory"
                    :min="0"
                    :max="9999"
                    :precision="0"
                    :controls="false"
                    class="full-width"
                  />
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'serial_tracking'"
                  label="SN管理"
                >
                  <el-switch
                    v-model="formData.serial_tracking"
                    :active-value="1"
                    :inactive-value="0"
                    :disabled="isEntryMode && !existingAccessory"
                    aria-label="SN管理"
                    title="模板开关为默认值，本次入库可单独切换SN模式"
                  />
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'free_film'"
                  label="免费专用"
                >
                  <el-switch
                    v-model="formData[field]"
                    :active-value="1"
                    :inactive-value="0"
                    :disabled="!!existingAccessory"
                    aria-label="免费专用"
                  />
                </el-form-item>
                <el-form-item
                  v-else-if="field === 'status'"
                  label="状态"
                >
                  <el-switch
                    v-model="formData.status"
                    :disabled="!!existingAccessory"
                    :active-value="1"
                    :inactive-value="0"
                    aria-label="状态"
                  />
                </el-form-item>
              </el-col>
            </el-row>
          </div>

          <!-- 条形码和图片放在商品资料之后 -->
          <div
            v-if="!isEntryMode"
            class="scan-image-section"
          >
            <div
              v-if="hasMultipleTemplateColors"
              class="tf-form-row tf-form-row--mobile-single"
              aria-label="颜色与条形码"
            >
              <el-form-item
                v-for="variant in formData.color_variants"
                :key="variant.color_id"
                :label="`${getColorName(variant.color_id)}条形码`"
              >
                <el-input
                  v-if="canViewAccessoryField('barcode')"
                  v-model="variant.barcode"
                  :maxlength="100"
                  clearable
                  placeholder="输入对应颜色条形码，可留空"
                  :aria-label="`${getColorName(variant.color_id)}条形码`"
                  @keydown.enter.prevent
                />
                <span v-else>{{ getColorName(variant.color_id) }}</span>
              </el-form-item>
              <el-alert
                v-if="colorVariantError"
                class="tf-form-field--wide"
                :title="colorVariantError"
                type="error"
                :closable="false"
              />
            </div>
            <div
              v-if="canViewAccessoryField('barcode') && !hasMultipleTemplateColors"
              class="scan-area"
            >
              <el-form-item label="条形码">
                <div class="barcode-input-wrapper">
                  <el-input
                    v-model="templateBarcode"
                    placeholder="手动输入或扫描条形码"
                    aria-label="条形码"
                    :disabled="isFixedTemplate"
                    :maxlength="100"
                    clearable
                    @keydown.enter.prevent
                  >
                    <template #prefix>
                      <i class="fas fa-barcode" />
                    </template>
                  </el-input>
                </div>
              </el-form-item>
            </div>

            <div
              v-if="canViewAccessoryField('image_url')"
              class="image-area"
            >
              <el-form-item
                class="tf-form-field--wide"
                label="商品图片"
              >
                <div
                  class="image-upload-wrapper"
                  @click="triggerUpload"
                >
                  <el-upload
                    ref="uploadRef"
                    :action="uploadUrl"
                    :headers="uploadHeaders"
                    :show-file-list="false"
                    :before-upload="beforeImageUpload"
                    :on-success="handleImageSuccess"
                    :on-error="handleUploadError"
                    accept="image/*"
                    name="file"
                    :auto-upload="false"
                    :disabled="!!existingAccessory"
                    class="image-uploader"
                  >
                    <div
                      v-if="formData.image_url"
                      class="image-preview"
                    >
                      <Image
                        :src="formData.image_url"
                        alt="配件图片"
                        mode="eager"
                      />
                      <div class="image-overlay">
                        <i class="fas fa-camera" />
                        <span>更换</span>
                      </div>
                    </div>
                    <div
                      v-else
                      class="image-placeholder"
                    >
                      <i class="fas fa-plus" />
                      <span>上传图片</span>
                    </div>
                  </el-upload>
                </div>
              </el-form-item>
            </div>
          </div>
        </div>

        <div
          v-if="isColorStockIn && canViewAccessoryField('total_quantity')"
          class="tf-query-modal-section"
          aria-label="按颜色填写入库数量"
        >
          <div
            class="tf-query-modal-section-title"
            role="heading"
            aria-level="3"
          >
            <i class="fas fa-layer-group" />
            <span>颜色库存</span>
          </div>
          <p class="text-secondary text-sm">
            进价、供应商和店铺共用；{{ formData.serial_tracking === 1 ? '按颜色录入SN，数量自动计算。' : '各颜色分别填写数量，0表示本次不入库。' }}
          </p>
          <div
            class="tf-form-row"
            :class="{ 'tf-form-row--mobile-single': formData.serial_tracking === 1 }"
          >
            <div
              v-for="row in colorStockRows"
              :key="row.accessory_id"
              class="color-stock-item"
            >
              <strong>{{ row.color_name }}</strong>
              <span
                v-if="canViewAccessoryField('barcode')"
                class="text-secondary text-xs"
              >条码：{{ row.barcode || '未设置' }}</span>
              <el-form-item
                v-if="formData.serial_tracking !== 1"
                :label="`${row.color_name}数量`"
              >
                <el-input-number
                  v-model="row.quantity"
                  :min="0"
                  :max="999999"
                  :controls="false"
                  :precision="0"
                  :aria-label="`${row.color_name}入库数量`"
                />
              </el-form-item>
              <template v-else-if="canViewAccessoryField('serial_number')">
                <el-form-item :label="`${row.color_name}SN（${colorSerials(row).length}件）`">
                  <el-input
                    v-model="row.serialInput"
                    v-identifier-input="'accessory-serial-list'"
                    type="textarea"
                    class="tf-textarea"
                    :rows="3"
                    :maxlength="101000"
                    :disabled="!formData.store_id"
                    :aria-label="`${row.color_name}SN`"
                    placeholder="每行一个SN，按颜色分别录入"
                  />
                </el-form-item>
                <el-button
                  type="primary"
                  :disabled="!formData.store_id"
                  @click="openColorSerialScanner(row.accessory_id)"
                >
                  扫码SN
                </el-button>
              </template>
            </div>
          </div>
          <el-alert
            v-if="colorStockError"
            :title="colorStockError"
            type="error"
            :closable="false"
          />
          <p
            class="text-primary font-semibold"
            aria-label="颜色入库合计"
          >
            合计 {{ colorStockQuantity }}{{ canViewAccessoryField('unit') ? formData.unit : '件' }}
            <template v-if="canViewAccessoryField('purchase_cost') && canViewAccessoryField('total_amount')">
              · 采购金额 ¥{{ formatAmount(colorStockQuantity * formData.purchase_cost) }}
            </template>
          </p>
        </div>

        <div
          v-if="isEntryMode && !isColorStockIn && formData.serial_tracking === 1 && canViewAccessoryField('serial_number') && canViewAccessoryField('distribution')"
          class="tf-query-modal-section"
        >
          <div
            class="tf-query-modal-section-title"
            role="heading"
            aria-level="3"
          >
            <span>
              SN序列号录入（{{ serialEntries.length }} 件）
            </span>
          </div>
          <div>
            <el-alert
              v-if="serialValidationError"
              :title="serialValidationError"
              type="error"
              :closable="false"
            />
            <div class="serial-toolbar tf-dialog-toolbar">
              <el-button
                type="primary"
                :disabled="!formData.store_id || serialRows.length >= 1000"
                @click="addSerialRow"
              >
                新增一条
              </el-button>
              <el-button
                type="primary"
                :disabled="!formData.store_id"
                @click="openSerialScanner()"
              >
                扫码SN
              </el-button>
              <el-button
                type="danger"
                :disabled="!serialRows.length"
                @click="clearSerialRows"
              >
                清空SN
              </el-button>
            </div>
            <el-form-item
              v-for="(row, index) in serialRows"
              :key="row.id"
              :label="`SN ${index + 1}`"
            >
              <div
                class="serial-entry-row tf-dialog-toolbar"
                :data-serial-row="row.id"
              >
                <el-input
                  v-model="row.value"
                  v-identifier-input="'accessory-serial'"
                  :maxlength="100"
                  placeholder="扫描或手动输入SN，回车继续下一条"
                  :disabled="!formData.store_id"
                  @keyup.enter.prevent="focusNextSerial(index)"
                />
                <el-button
                  type="primary"
                  :disabled="!formData.store_id"
                  @click="openSerialScanner(row.id)"
                >
                  扫码
                </el-button>
                <el-button
                  type="danger"
                  @click="removeSerialRow(row.id)"
                >
                  移除
                </el-button>
              </div>
            </el-form-item>
            <el-form-item
              class="tf-form-field--wide"
              label="批量录入SN"
            >
              <el-input
                v-model="serialBatchInput"
                v-identifier-input="'accessory-serial-list'"
                type="textarea"
                class="tf-textarea"
                :rows="3"
                :maxlength="101000"
                placeholder="每行一个SN，粘贴多条后点击添加"
                :disabled="!formData.store_id"
              />
            </el-form-item>
            <div class="tf-dialog-toolbar">
              <el-button
                type="primary"
                :disabled="!formData.store_id || !serialBatchInput.trim()"
                @click="appendSerialBatch"
              >
                添加多条SN
              </el-button>
            </div>
          </div>
        </div>

        <!-- 备注 -->
        <div
          v-if="canViewAccessoryField('remarks')"
          class="tf-query-modal-section"
        >
          <div
            class="tf-query-modal-section-title"
            role="heading"
            aria-level="3"
          >
            <i class="fas fa-sticky-note" />
            <span>
              备注信息
            </span>
          </div>
          <div>
            <el-form-item
              class="tf-form-field--wide"
              label="备注"
            >
              <el-input
                v-model="formData.remarks"
                class="tf-textarea"
                type="textarea"
                :rows="2"
                placeholder="请输入备注信息（可选）"
                :maxlength="1000"
              />
            </el-form-item>
          </div>
        </div>
      </el-form>
    </div>

    <OptimizedScanner
      v-if="serialScannerVisible"
      v-model:visible="serialScannerVisible"
      scan-type="serial"
      serial-profile="accessory"
      :serial-brand="selectedAccessoryBrandName"
      :scan-validator="validateSerialScan"
      @success="acceptSerialScan"
      @manual="serialScannerVisible = false"
      @cancel="serialScannerVisible = false"
    />

    <template #footer>
      <div class="tf-dialog-actions">
        <el-button
          :disabled="submitting"
          @click="handleClose"
        >
          <i class="fas fa-times" />
          取消
        </el-button>
        <el-button
          v-permission="isEditMode || isCorrectionMode ? 'accessories:edit' : isStockInMode ? 'accessories:stock-in' : 'accessories:create'"
          type="primary"
          :class="{ 'tf-button--transfer': isEntryMode }"
          :loading="submitting"
          :disabled="submitting || (isStockInMode && purchaseStore.submitting) || (pendingCorrection ? !canRetryCorrection : pendingStockIn ? !canRetryStockIn : !canSubmit)"
          @click="handleSubmit"
        >
          <i class="fas fa-check" />
          {{ isCorrectionMode ? pendingCorrection ? '重试原更正' : '保存更正' : props.profileEditOnly ? '保存档案' : isEditMode ? '保存模板' : props.archiveOnly ? '创建模板' : pendingStockIn ? '重试原入库' : '确认入库' }}
        </el-button>
      </div>
    </template>
  </MobileDialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, defineAsyncComponent } from 'vue'
import { useSelectLoadMore } from '@/composables/useSelectLoadMore'
import { normalizeAccessorySerial, isValidAccessorySerial } from '@/utils/accessory-serial'
import Pagination from '@/components/Pagination.vue'
import SectionLoading from '@/components/SectionLoading.vue'

const OptimizedScanner = defineAsyncComponent(() => import('@/components/OptimizedScanner.vue'))

import type { FormInstance, UploadRawFile } from 'element-plus'
import { unifiedApi } from '@/utils/unified-api'
import { getAccessoryEntryOptions } from '@/services/reference-options'
import type { AccessoryUsageType, AccessoryRecord, AccessoryColorVariantInput, AccessoryStockInRequest, AccessoryStockInReceipt, AccessoryColorStockInReceipt, AccessoryStockCorrectionOption, AccessoryStockCorrectionContext, AccessoryStockCorrectionInput } from '@/types/accessory'
import { useAccessoryStockInStore } from '@/stores/accessory-stock-in'
import { createCheckoutKey } from '@/utils/sales-checkout'
import { getAccessoryStockCorrectionOptions, getAccessoryStockCorrectionContext, correctAccessoryStockIn } from '@/api/accessory-inventory'
import { isAccessoryStockCorrectionContext, isAccessoryStockInReceipt, isAccessoryColorStockInReceipt } from '@/utils/accessory-stock-in'
import type { PaginatedResponse } from '@/types'
import { useLatestRequest } from '@/composables/useLatestRequest'
import type { ReferenceRecord } from '@/services/reference-options'
import { deleteTempFiles } from '@/utils/temp-file-cleaner'
import { formatAmount, formatDateTime } from '@/utils/format'
import { TimeUtil, TIME_FORMATS } from '@/utils/time'
import { useAuthStore } from '@/stores/auth'
import { usePagePermissions } from '@/composables/usePagePermissions'
import { logger } from '@/utils/logger'
import { getRequestErrorMessage, getRequestErrorPayload, getRequestErrorStatus } from '@/utils/api-response'
import type { ModelValueProps, UpdateModelValueEmits, SuccessEmits, CloseEmits } from '@/types/component'
import Image from './Image.vue'
import { storage } from '@/services/storage'
import {
  buildAccessoryStockInPayload,
  buildAccessoryStockCorrectionPayload,
  buildAccessoryUpdatePayload
} from './accessory-payload'
import { fieldPermissions } from '@/composables/useFieldPermissions'
import {
  canViewAccessoryField,
  pickVisibleAccessoryFields,
  type AccessoryFieldName
} from './accessory-field-permissions'
import { useNotification } from '@/composables/useNotification'
const globalNotifications = useNotification()


// Props
interface AccessoryStoreOption {
  id: number
  name: string
}

interface AccessoryOption {
  id: number
  name: string
  brand_id?: number
  status?: number
  sort_order?: number
}

interface AccessoryImageUploadResponse {
  success: boolean
  data?: { url?: string }
}

interface Props extends ModelValueProps {
  accessory?: AccessoryRecord
  archiveOnly?: boolean
  stockInOnly?: boolean
  stockEditOnly?: boolean
  profileEditOnly?: boolean
}

type Emits = UpdateModelValueEmits & SuccessEmits & CloseEmits

const emit = defineEmits<Emits>()

const props = defineProps<Props>()
const authStore = useAuthStore()
const { canEdit: canEditStock, canView, requirePermission } = usePagePermissions('accessories')
const purchaseStore = useAccessoryStockInStore()
const purchaseActorId = computed(() => Number(authStore.user?.id))
const pendingStockIn = computed(() => isStockInMode.value ? purchaseStore.pending[purchaseActorId.value] : undefined)
const recoveryError = ref('')

// 表单引用
const formRef = ref<FormInstance>()
const filmReady = ref(false)

// 编辑模式判断
const isCorrectionMode = computed(() => Boolean(props.stockEditOnly))
const isEditMode = computed(() => !isCorrectionMode.value && Boolean(props.accessory?.id) && !props.stockInOnly)
const isStockInMode = computed(() => !isCorrectionMode.value && !props.archiveOnly && !isEditMode.value)
const isEntryMode = computed(() => isStockInMode.value || isCorrectionMode.value)
const isFixedTemplate = computed(() => isStockInMode.value && props.stockInOnly && Boolean(props.accessory?.id))
type AccessoryFormField = AccessoryFieldName | 'model_brand'

const basicFields = computed(() => {
  const order: AccessoryFormField[] = isEntryMode.value
    ? ['supplier_name', 'brand_name', 'name', 'distribution', 'category', 'product_model', 'color_name', 'barcode', 'purchase_cost', 'sale_price', 'total_quantity', 'operator_name', 'usage_type', 'serial_tracking', 'inventory_time'] as const
    : (props.profileEditOnly || props.accessory?.template_id
      ? ['brand_name', 'name', 'category', 'model_brand', 'model_name', 'product_model', 'color_name', 'unit', 'sale_price', 'min_stock', 'status', 'serial_tracking', 'free_film']
      : ['name', 'category', 'model_brand', 'model_name', 'product_model', 'color_name', 'unit', 'sale_price', 'min_stock', 'status', 'serial_tracking', 'free_film']) as AccessoryFormField[]
  return order.filter(field => (field !== 'free_film' || filmReady.value) && !(isColorStockIn.value && ['color_name', 'barcode', 'total_quantity'].includes(field)) &&
    !(isEntryMode.value && field === 'total_quantity' && formData.value.serial_tracking === 1) && canViewAccessoryField(
    field === 'model_brand' ? 'model_name' : field
  ))
})
const profileCorrectionRows = computed(() => {
  const optionName = (options: AccessoryOption[], id: number | null) => options.find(option => option.id === id)?.name || ''
  const modelNames = (ids: number[]) => ids.map(id => optionName(models.value, id)).filter(Boolean).join('、') || '通用'
  return ([
    { field: 'name', label: '商品名称', before: props.accessory?.name || '', after: formData.value.name },
    { field: 'brand_name', label: '配件品牌', before: props.accessory?.brand_name || '', after: optionName(brands.value, formData.value.brand_id) },
    { field: 'category', label: '商品类型', before: props.accessory?.category || '', after: optionName(categories.value, formData.value.category_id) },
    { field: 'model_name', label: '适配型号', before: props.accessory?.compatible_model_names || props.accessory?.model_name || '通用', after: modelNames(formData.value.model_ids) },
    { field: 'product_model', label: '配件型号', before: props.accessory?.product_model || '', after: formData.value.product_model },
    { field: 'color_name', label: '颜色', before: persistedTemplateColors.value.map(row => row.color_name || getColorName(row.color_id)).join('、'),
      after: formData.value.color_variants.map(row => getColorName(row.color_id)).join('、') || optionName(colors.value, formData.value.color_id) },
    { field: 'unit', label: '单位', before: props.accessory?.unit || '', after: optionName(units.value, formData.value.unit_id) },
    { field: 'sale_price', label: '零售价', before: props.accessory?.sale_price === undefined ? '' : `¥${formatAmount(props.accessory.sale_price)}`, after: `¥${formatAmount(formData.value.sale_price)}` }
  ] satisfies { field: AccessoryFieldName; label: string; before: string; after: string }[]).filter(row => canViewAccessoryField(row.field))
})

// 响应式数据
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const templateSearchRequest = useLatestRequest()
const templateResults = ref<AccessoryRecord[]>([])
const templatePage = ref(1)
const templatePageSize = 20
const templateTotal = ref(0)
const templateKeyword = ref('')
const templatesLoading = ref(false)
const templateError = ref('')
const templateHasMore = computed(() => templatePage.value * templatePageSize < templateTotal.value)
const accessorySelectionRequest = useLatestRequest()
const searching = ref(false)
const submitting = ref(false)
const existingAccessory = ref<AccessoryRecord | null>(null)
const uploadedTempImages = ref<string[]>([])

const correctionOptions = ref<AccessoryStockCorrectionOption[]>([])
const correctionContext = ref<AccessoryStockCorrectionContext | null>(null)
const selectedPurchaseId = ref<number>()
const correctionPage = ref(1), correctionTotal = ref(0)
const correctionOptionsLoading = ref(false), correctionLoading = ref(false), correctionError = ref('')
const correctionRequests = useLatestRequest(), correctionOptionsRequests = useLatestRequest()
const pendingCorrection = ref<AccessoryStockCorrectionInput | null>(null)
const correctionActorId = ref<number>()
const canRetryCorrection = computed(() => canEditStock.value && canView.value && correctionActorId.value === purchaseActorId.value && Boolean(pendingCorrection.value) && Object.keys(pendingCorrection.value || {}).every(key =>
  key === 'request_key' || Boolean(accessoryPayloadFieldMap[key] && canViewAccessoryField(accessoryPayloadFieldMap[key]))))

const correctionOptionLabel = (batch: AccessoryStockCorrectionOption) => [
  canViewAccessoryField('batch_no') ? batch.batch_no : `批次 ${batch.purchase_id}`,
  batch.supplier_name, batch.store_name, `${batch.quantity} 件`, `¥${formatAmount(batch.purchase_cost)}`
].filter(Boolean).join(' · ')

const resetCorrection = () => {
  correctionRequests.cancelLatest(); correctionOptionsRequests.cancelLatest()
  correctionOptions.value = []; correctionContext.value = null; selectedPurchaseId.value = undefined
  correctionPage.value = 1; correctionTotal.value = 0; correctionError.value = ''
  correctionOptionsLoading.value = false; correctionLoading.value = false; pendingCorrection.value = null
  correctionActorId.value = purchaseActorId.value
}

const loadCorrectionContext = async (id: number) => {
  if (submitting.value || pendingCorrection.value || !Number.isSafeInteger(id) || id < 1) return
  const request = correctionRequests.nextRequest()
  correctionContext.value = null; correctionError.value = ''; correctionLoading.value = true
  resetFormData()
  try {
    const response = await getAccessoryStockCorrectionContext(id, request.signal)
    if (!request.isLatest() || !visible.value) return
    if (!response.success || !isAccessoryStockCorrectionContext(response.data, id)) throw new Error('原入库资料不完整，无法更正')
    const context = response.data
    correctionContext.value = context
    existingAccessory.value = context.accessory
    applyAccessory(context.accessory)
    Object.assign(formData.value, {
      supplier_id: context.supplier_id, purchase_cost: context.purchase_cost, store_id: context.store_id,
      total_quantity: context.total_quantity, usage_type: context.usage_type, serial_tracking: context.serial_tracking,
      remarks: canViewAccessoryField('remarks') ? context.remarks || '' : ''
    })
    serialRows.value = (context.serial_numbers || []).map(serial => ({ id: ++nextSerialRowId, value: serial.serial_number }))
    await loadOptions()
    if (request.isLatest() && visible.value) await loadModels()
  } catch (error) {
    if (request.isLatest() && !correctionRequests.isCanceledError(error)) {
      correctionContext.value = null
      correctionError.value = getRequestErrorMessage(error, '原入库资料读取失败，请重新选择批次')
    }
  } finally { if (request.isLatest()) correctionLoading.value = false }
}

const loadCorrectionOptions = async () => {
  if (!props.accessory?.id) return
  const request = correctionOptionsRequests.nextRequest()
  correctionOptionsLoading.value = true; correctionError.value = ''
  try {
    const response = await getAccessoryStockCorrectionOptions(props.accessory.id, correctionPage.value, request.signal)
    if (!request.isLatest() || !visible.value) return
    const result = response.data
    if (!response.success || !result || !Array.isArray(result.data) || !Number.isSafeInteger(result.pagination?.total) ||
      result.data.some(row => !Number.isSafeInteger(row.purchase_id) || row.purchase_id < 1)) throw new Error('入库批次响应不完整')
    correctionOptions.value = result.data
    correctionTotal.value = result.pagination.total
    if (!result.pagination.total) correctionError.value = '该商品没有可更正的原入库批次；历史来源不明库存须先核对。'
    if (result.pagination.total === 1 && result.data[0]) {
      selectedPurchaseId.value = result.data[0].purchase_id
      await loadCorrectionContext(selectedPurchaseId.value)
    }
  } catch (error) {
    if (request.isLatest() && !correctionOptionsRequests.isCanceledError(error)) {
      correctionOptions.value = []; correctionTotal.value = 0
      correctionError.value = getRequestErrorMessage(error, '读取入库批次失败，请关闭后重试')
    }
  } finally { if (request.isLatest()) correctionOptionsLoading.value = false }
}

const changeCorrectionPage = (page: number) => { correctionPage.value = page; void loadCorrectionOptions() }

const submitCorrection = async () => {
  const input = pendingCorrection.value, purchaseId = selectedPurchaseId.value
  if (!input || !purchaseId || !canRetryCorrection.value || !requirePermission('edit')) return
  const actorId = purchaseActorId.value
  submitting.value = true
  try {
    await fieldPermissions.init()
    if (!canRetryCorrection.value) throw new Error('字段权限已变化，请重新核对后重试')
    const response = await correctAccessoryStockIn(purchaseId, input)
    if (purchaseActorId.value !== actorId) return
    if (!response.success || !isAccessoryStockInReceipt(response.data)) throw new Error('更正回执尚未确认，请重试原更正核对')
    pendingCorrection.value = null
    globalNotifications.success(response.data.replayed ? '已核对原更正结果，未重复调整库存' : '商品库存更正成功')
    visible.value = false
    emit('success')
  } catch (error) {
    const status = getRequestErrorStatus(error)
    if (status === 400 || status === 403 || status === 404 || status === 409) pendingCorrection.value = null
    globalNotifications.error(getRequestErrorMessage(error, '更正失败，请重试原更正核对结果'))
  } finally { submitting.value = false }
}

const getTemplateCategory = (item: AccessoryRecord) => item.category ||
  categories.value.find(category => category.id === Number(item.category_id))?.name || '未设置类型'

const templateGroups = computed(() => {
  if (!canViewAccessoryField('name')) return []
  const selected = existingAccessory.value
    ? { ...existingAccessory.value, id: existingAccessory.value.color_template_id || existingAccessory.value.id }
    : null
  const items = selected && !templateKeyword.value
    ? [selected, ...templateResults.value.filter(item => item.id !== selected.id)]
    : templateResults.value
  const groups = new Map<string, AccessoryRecord[]>()
  for (const item of items) {
    const category = canViewAccessoryField('category') ? getTemplateCategory(item) : '商品'
    const group = groups.get(category) || []
    group.push(item)
    groups.set(category, group)
  }
  return [...groups].map(([name, items]) => ({ name, items }))
})

const getTemplateLabel = (item: AccessoryRecord) => canViewAccessoryField('name') ? item.name : ''

const getTemplateDetails = (item: AccessoryRecord) => [
  canViewAccessoryField('product_model') && item.product_model ? `型号 ${item.product_model}` : '',
  canViewAccessoryField('color_name') ? item.color_variants?.map(row => row.color_name).filter(Boolean).join('、') || item.color_name || '' : '',
  canViewAccessoryField('model_name') ? `适配 ${item.compatible_model_names || item.model_name || '通用'}` : '',
  canViewAccessoryField('sale_price') && item.sale_price !== undefined && item.sale_price !== null
    ? `零售 ¥${formatAmount(item.sale_price)}${canViewAccessoryField('unit') && item.unit ? `/${item.unit}` : ''}` : '',
  canViewAccessoryField('serial_tracking') && Number(item.serial_tracking) === 1 ? '默认SN管理' : ''
].filter(Boolean).join(' · ')

const loadTemplates = async (append = false) => {
  if (!visible.value || !isEntryMode.value || isFixedTemplate.value || !canViewAccessoryField('name')) return
  const request = templateSearchRequest.nextRequest()
  const page = append ? templatePage.value + 1 : 1
  templatesLoading.value = true
  templateError.value = ''
  try {
    const response = await unifiedApi.get<Pick<PaginatedResponse<AccessoryRecord>, 'data' | 'pagination'>>('/accessories', {
      params: { mode: 'templates', page, page_size: templatePageSize, search: templateKeyword.value || undefined },
      signal: request.signal, useCache: false, showLoading: false, showError: false
    })
    if (!request.isLatest() || !visible.value) return
    const data = response.data
    const total = Number(data?.pagination?.total)
    if (response.success === false || !Array.isArray(data?.data) || !Number.isSafeInteger(total) || total < 0) {
      throw new Error('商品检索响应无效，请重试')
    }
    const rows = data.data.map(item => ({ ...item, id: Number(item.id) }))
    if (rows.some(item => !Number.isSafeInteger(item.id) || item.id <= 0)) throw new Error('商品编号无效，请重试')
    templateResults.value = [...new Map((append ? [...templateResults.value, ...rows] : rows).map(item => [item.id, item])).values()]
    templateTotal.value = total
    templatePage.value = page
  } catch (err) {
    if (!request.isLatest() || templateSearchRequest.isCanceledError(err)) return
    if (!append) { templateResults.value = []; templateTotal.value = 0 }
    templateError.value = '商品检索失败，请重试'
    logger.error('加载商品模板失败', err)
    globalNotifications.error(getRequestErrorMessage(err, '商品检索失败，请重试'))
  } finally {
    if (request.isLatest()) templatesLoading.value = false
  }
}

const searchTemplates = async (keyword: string) => {
  templateKeyword.value = keyword.trim()
  templatePage.value = 1
  templateResults.value = []
  templateTotal.value = 0
  await loadTemplates()
}

const handleTemplateDropdown = (opened: boolean) => {
  // 远程加载时浮层可再次触发 visible-change；不能因此清空结果或重置关键词。
  if (opened && !isFixedTemplate.value && !templatesLoading.value && !templateResults.value.length && !templateError.value) {
    void loadTemplates()
  }
}

const loadMoreTemplates = async () => {
  if (templatesLoading.value || !templateHasMore.value) return
  await loadTemplates(true)
}
const { selectRef: templateSelectRef, onPopupScroll: handleTemplateScroll } = useSelectLoadMore(
  loadMoreTemplates, () => templatesLoading.value || !!templateError.value || !templateHasMore.value
)

// 表单数据
const formData = ref({
  inventory_time: TimeUtil.nowFormatted(TIME_FORMATS.DATETIME),
  color_variants: [] as Array<AccessoryColorVariantInput & { barcode: string }>,
  barcode: '',
  accessory_id: null as number | null,
  id: null as number | null,
  name: '',
  category: '',
  category_id: null as number | null,
  product_model: '',
  serial_tracking: 0,
  free_film: 0,
  usage_type: 'sale' as AccessoryUsageType,
  brand_id: null as number | null,
  model_id: null as number | null,
  model_ids: [] as number[],
  color_id: null as number | null,
  supplier_id: null as number | null,
  purchase_cost: 0,
  sale_price: 0,
  unit: '个',
  unit_id: null as number | null,
  status: 1,
  min_stock: 5,
  image_url: '',
  total_quantity: 1,
  store_id: null as number | null,
  remarks: ''
})

const persistedTemplateColors = computed(() => props.accessory?.color_variants?.length ? props.accessory.color_variants
  : props.accessory?.id && props.accessory.color_id ? [{ accessory_id: Number(props.accessory.template_id || props.accessory.id),
    color_id: Number(props.accessory.color_id), color_name: props.accessory.color_name, barcode: props.accessory.barcode }] : [])
const canManageColorVariants = computed(() => canViewAccessoryField('color_name') && !isEntryMode.value && (props.archiveOnly || isEditMode.value))
const hasColorVariantRows = computed(() => canManageColorVariants.value && formData.value.color_variants.length > 0)
const hasMultipleTemplateColors = computed(() => canManageColorVariants.value && formData.value.color_variants.length > 1)
const templateBarcode = computed({
  get: () => hasColorVariantRows.value && formData.value.color_variants.length === 1
    ? formData.value.color_variants[0].barcode : formData.value.barcode,
  set: (barcode: string) => {
    if (hasColorVariantRows.value && formData.value.color_variants.length === 1) formData.value.color_variants[0].barcode = barcode
    else formData.value.barcode = barcode
  }
})
const selectedTemplateColors = computed({
  get: () => formData.value.color_variants.map(row => row.color_id),
  set: (ids: number[]) => {
    const previous = formData.value.color_variants
    if (!ids.length && previous.length === 1) formData.value.barcode = previous[0].barcode
    formData.value.color_variants = ids.map((id, index) => previous.find(row => row.color_id === id) || {
      color_id: id, barcode: !previous.length && index === 0 ? formData.value.barcode : ''
    })
    if (ids.length) { formData.value.color_id = null; formData.value.barcode = '' }
  }
})
const selectedStockColor = computed(() => {
  const rootId = Number(existingAccessory.value?.template_id || existingAccessory.value?.id)
  const variants = existingAccessory.value?.color_variants
  return variants?.some(row => row.accessory_id === rootId) ? rootId
    : isStockInMode.value && variants?.length === 1 ? variants[0].accessory_id : undefined
})
const isColorStockIn = computed(() => isStockInMode.value && canViewAccessoryField('color_name') && (existingAccessory.value?.color_variants?.length || 0) > 1)
interface ColorStockRow {
  accessory_id: number
  color_id: number
  color_name: string
  barcode: string
  quantity: number | undefined
  serialInput: string
}
const colorStockRows = ref<ColorStockRow[]>([])
const resetColorStockRows = (accessory?: AccessoryRecord) => {
  const rootId = Number(accessory?.template_id || accessory?.id)
  colorStockRows.value = (accessory?.color_variants || []).map(row => ({ ...row,
    color_name: row.color_name || getColorName(row.color_id), barcode: canViewAccessoryField('barcode') ? row.barcode || '' : '',
    quantity: rootId === row.accessory_id ? 1 : 0, serialInput: '' }))
}
const colorSerials = (row: ColorStockRow) => row.serialInput.split(/\r?\n/).map(normalizeAccessorySerial).filter(Boolean)
const colorStockQuantity = computed(() => colorStockRows.value.reduce((sum, row) => sum +
  (formData.value.serial_tracking === 1 ? colorSerials(row).length : Number(row.quantity || 0)), 0))
const colorStockError = computed(() => {
  if (!isColorStockIn.value) return ''
  if (formData.value.serial_tracking === 1) {
    const serials = colorStockRows.value.flatMap(colorSerials)
    if (serials.some(value => !isValidAccessorySerial(value))) return 'SN格式不正确，请按颜色核对'
    if (new Set(serials).size !== serials.length) return '本次入库存在重复SN，请核对各颜色'
    if (serials.length > 1000) return '本次所有颜色合计最多录入1000条SN'
  } else if (colorStockRows.value.some(row => !Number.isSafeInteger(row.quantity) || Number(row.quantity) < 0 || Number(row.quantity) > 999999)) {
    return '各颜色数量须为0至999999的整数'
  }
  if (colorStockQuantity.value > 999999) return '本次入库合计不能超过999999件'
  if (Math.round(formData.value.purchase_cost * 100) * colorStockQuantity.value >= 10000000000) return '采购总额超出允许范围，请分次入库'
  return ''
})
const colorVariantError = computed(() => {
  if (!hasColorVariantRows.value || !canViewAccessoryField('barcode')) return ''
  const barcodes = formData.value.color_variants.map(row => row.barcode.trim().toLowerCase()).filter(Boolean)
  return new Set(barcodes).size !== barcodes.length ? '不同颜色不能使用相同条形码' : ''
})

const templatePayloadSource = () => {
  const source = { ...formData.value, free_film: filmReady.value ? formData.value.free_film : undefined }
  if (!hasColorVariantRows.value) return { ...source, color_variants: undefined }
  const variants = formData.value.color_variants
  if (isEditMode.value && !props.accessory?.color_template_id && variants.length === 1) {
    return { ...source, color_variants: undefined, color_id: variants[0].color_id, barcode: variants[0].barcode }
  }
  return { ...source, color_id: undefined, barcode: undefined,
    color_variants: variants.map(row => ({ color_id: row.color_id,
      ...(canViewAccessoryField('barcode') ? { barcode: row.barcode } : {}) })) }
}
const stockTemplateColorsSummary = computed(() => {
  const variants = existingAccessory.value?.color_variants
  if (!isEntryMode.value || !canViewAccessoryField('color_name') || !variants || variants.length <= 1) return ''
  return `模板颜色：${variants.map(row => [row.color_name || '未命名颜色',
    canViewAccessoryField('barcode') && row.barcode ? `条码 ${row.barcode}` : ''].filter(Boolean).join(' · ')).join('；')}`
})

const isRestocking = computed(() => !isEditMode.value && !props.archiveOnly && Boolean(formData.value.accessory_id))

// 表单验证规则
const formRules = {
  name: [{ required: true, message: '请输入配件名称', trigger: 'blur' }],
  category_id: [{ required: true, message: '请选择商品类型', trigger: 'change' }],
  unit_id: [{ required: true, message: '请选择计量单位', trigger: 'change' }],
  supplier_id: [{ required: true, message: '请选择供应商', trigger: 'change' }],
  purchase_cost: [{ required: true, message: '请输入进价', trigger: 'blur' }],
  total_quantity: [{ required: true, message: '请输入入库数量', trigger: 'blur' }]
}

// 下拉选项数据
const categories = ref<AccessoryOption[]>([])
const units = ref<AccessoryOption[]>([])
const brands = ref<AccessoryOption[]>([])
const modelBrands = ref<AccessoryOption[]>([])
const modelBrandId = ref<number | null>(null)
const modelsLoading = ref(false)
const optionsLoading = ref(false)
const optionsReady = ref(false)
let modelRequestId = 0
let optionsRequestId = 0
let hydrating = false
const models = ref<AccessoryOption[]>([])
const colors = ref<AccessoryOption[]>([])
const getColorName = (id: number) => colors.value.find(color => Number(color.id) === id)?.name ||
  persistedTemplateColors.value.find(color => color.color_id === id)?.color_name || '颜色'
const suppliers = ref<AccessoryOption[]>([])
const stores = ref<AccessoryStoreOption[]>([])
let nextSerialRowId = 0
const serialRows = ref<Array<{ id: number; value: string }>>([])
const serialBatchInput = ref('')
const serialScannerVisible = ref(false)
const serialScanTarget = ref<number | null>(null)
const colorSerialScanTarget = ref<number | null>(null)
const selectedAccessoryBrandName = computed(() => brands.value.find(brand => Number(brand.id) === Number(formData.value.brand_id))?.name || '')
const serialEntries = computed(() => serialRows.value.map(row => normalizeAccessorySerial(row.value)).filter(Boolean)
  .map(serial_number => ({ serial_number, store_id: Number(formData.value.store_id) })))
const serialValidationError = computed(() => {
  const values = serialEntries.value.map(item => item.serial_number)
  if (values.some(value => !isValidAccessorySerial(value))) return 'SN只能包含字母、数字、点、横线、下划线或斜线，最多100位'
  if (new Set(values).size !== values.length) return '本次入库存在重复SN，请核对'
  if (values.length > 1000) return '本次最多录入1000条SN'
  return ''
})
const focusSerialRow = async (id: number) => {
  await nextTick()
  const root: HTMLElement | undefined = formRef.value?.$el
  root?.querySelector<HTMLInputElement>(`[data-serial-row="${id}"] input`)?.focus()
}
const addSerialRow = () => {
  if (!formData.value.store_id || serialRows.value.length >= 1000) return
  const id = ++nextSerialRowId
  serialRows.value.push({ id, value: '' })
  void focusSerialRow(id)
}
const focusNextSerial = (index: number) => {
  const next = serialRows.value[index + 1]
  if (next) void focusSerialRow(next.id)
  else if (serialRows.value[index]?.value.trim()) addSerialRow()
}
const removeSerialRow = (id: number) => { serialRows.value = serialRows.value.filter(row => row.id !== id) }
const clearSerialRows = () => { serialRows.value = isEntryMode.value && formData.value.serial_tracking === 1 ? [{ id: ++nextSerialRowId, value: '' }] : []; serialBatchInput.value = ''; serialScannerVisible.value = false }
const appendSerialBatch = () => {
  const values = serialBatchInput.value.split(/\r?\n/).map(normalizeAccessorySerial).filter(Boolean)
  const all = [...serialEntries.value.map(item => item.serial_number), ...values]
  if (all.some(value => !isValidAccessorySerial(value))) {
    globalNotifications.warning('SN格式不正确，请核对后再添加')
    return
  }
  if (new Set(all).size !== all.length) {
    globalNotifications.warning('本次入库存在重复SN，请核对后再添加')
    return
  }
  if (all.length > 1000) {
    globalNotifications.warning('本次最多录入1000条SN')
    return
  }
  for (const value of values) {
    const empty = serialRows.value.find(row => !row.value.trim())
    if (empty) empty.value = value
    else serialRows.value.push({ id: ++nextSerialRowId, value })
  }
  serialBatchInput.value = ''
}
const openSerialScanner = (id?: number) => {
  if (submitting.value || pendingStockIn.value) return
  serialScanTarget.value = id ?? null
  colorSerialScanTarget.value = null
  serialScannerVisible.value = true
}
const openColorSerialScanner = (id: number) => {
  if (submitting.value || pendingStockIn.value || !formData.value.store_id) return
  colorSerialScanTarget.value = id
  serialScannerVisible.value = true
}
const validateSerialScan = (raw: string): string | null => {
  const value = normalizeAccessorySerial(raw)
  if (isColorStockIn.value) {
    const row = colorStockRows.value.find(row => row.accessory_id === colorSerialScanTarget.value)
    if (!row || !isValidAccessorySerial(value)) return 'SN格式不正确，请重新扫描'
    if (colorStockRows.value.flatMap(colorSerials).includes(value)) return '该SN已录入，请勿重复扫描'
    if (colorStockQuantity.value >= 1000) return '本次最多录入1000条SN'
    return null
  }
  const target = serialRows.value.find(row => row.id === serialScanTarget.value)
  if (!isValidAccessorySerial(value)) return 'SN格式不正确，请重新扫描'
  if (serialRows.value.some(row => row.id !== target?.id && normalizeAccessorySerial(row.value) === value)) return '该SN已录入，请勿重复扫描'
  if (!target?.value.trim() && serialEntries.value.length >= 1000) return '本次最多录入1000条SN'
  return null
}
const acceptSerialScan = (raw: string) => {
  const value = normalizeAccessorySerial(raw)
  const validationMessage = validateSerialScan(raw)
  if (validationMessage) {
    globalNotifications.warning(validationMessage)
    return
  }
  if (isColorStockIn.value) {
    const row = colorStockRows.value.find(row => row.accessory_id === colorSerialScanTarget.value)
    if (!row) return
    row.serialInput = [value, ...colorSerials(row)].join('\n')
    return
  }
  const target = serialRows.value.find(row => row.id === serialScanTarget.value)
    ?? serialRows.value.find(row => !row.value.trim())
  const scannedRow = target || { id: ++nextSerialRowId, value }
  scannedRow.value = value
  serialRows.value = [scannedRow, ...serialRows.value.filter(row => row.id !== scannedRow.id)]
}
const normalizeAccessoryOption = (item: ReferenceRecord): AccessoryOption => ({
  id: Number(item.id || 0),
  name: String(item.name || ''),
  brand_id: item.brand_id === null || item.brand_id === undefined ? undefined : Number(item.brand_id),
  status: item.status,
  sort_order: Number(item.sort_order || 0)
})
const accessoryPayloadFieldMap: Record<string, AccessoryFieldName> = {
  color_variants: 'color_name',
  barcode: 'barcode', accessory_id: 'name', name: 'name', category: 'category', category_id: 'category', product_model: 'product_model',
  free_film: 'free_film',
  usage_type: 'usage_type', serial_tracking: 'serial_tracking', serial_numbers: 'serial_number',
  brand_id: 'brand_name', model_id: 'model_name', model_ids: 'model_name', color_id: 'color_name', supplier_id: 'supplier_name',
  purchase_cost: 'purchase_cost', sale_price: 'sale_price', unit: 'unit', unit_id: 'unit',
  status: 'status', min_stock: 'min_stock', total_quantity: 'total_quantity', distribution: 'distribution',
  store_id: 'distribution', remarks: 'remarks', description: 'description', image_url: 'image_url', inventory_time: 'inventory_time'
}

const canRetryStockIn = computed(() => {
  const input = pendingStockIn.value
  if (!input || recoveryError.value) return false
  const entries = 'entries' in input ? input.entries : [input]
  return (!('entries' in input) || canViewAccessoryField('color_name')) && entries.every(entry => Object.keys(entry).every(key => key === 'request_key' ||
    Boolean(accessoryPayloadFieldMap[key] && canViewAccessoryField(accessoryPayloadFieldMap[key]))))
})

// 计算属性
const canSubmit = computed(() => {
  if (colorVariantError.value) return false
  if (isStockInMode.value && existingAccessory.value?.color_variants?.length && !canViewAccessoryField('color_name')) return false
  if (isEntryMode.value && !isColorStockIn.value && existingAccessory.value?.color_variants?.length && !selectedStockColor.value) return false
  if (isColorStockIn.value && (colorStockError.value || !colorStockQuantity.value ||
    formData.value.serial_tracking === 1 && !canViewAccessoryField('serial_number'))) return false
  if (isCorrectionMode.value && (!canEditStock.value || !canView.value || !correctionContext.value || correctionLoading.value || correctionError.value)) return false
  if (isStockInMode.value && recoveryError.value) return false
  if (isStockInMode.value && canViewAccessoryField('inventory_time') && (typeof formData.value.inventory_time !== 'string' ||
    !TimeUtil.isValid(formData.value.inventory_time, TIME_FORMATS.DATETIME) ||
    TimeUtil.format(formData.value.inventory_time, TIME_FORMATS.DATETIME) !== formData.value.inventory_time)) return false
  if (searching.value || !optionsReady.value || optionsLoading.value || modelsLoading.value) return false
  if (isEditMode.value) {
    const editableFields = Object.values(accessoryPayloadFieldMap).some(canViewAccessoryField)
    return editableFields && (!canViewAccessoryField('name') || Boolean(formData.value.name))
  }
  if (props.archiveOnly) {
    return canViewAccessoryField('name') && Boolean(formData.value.name && formData.value.category_id && formData.value.unit_id)
  }
  if (!isColorStockIn.value && formData.value.serial_tracking === 1 && (!canViewAccessoryField('serial_number') || serialEntries.value.length === 0 || serialEntries.value.length > 1000 || serialBatchInput.value.trim() || serialValidationError.value)) return false
  if (!['name', 'supplier_name', 'purchase_cost', 'total_quantity', 'distribution', 'usage_type'].every(field => canViewAccessoryField(field as AccessoryFieldName))) return false
  return (
    formData.value.accessory_id &&
    formData.value.name &&
    (!canViewAccessoryField('category') || formData.value.category_id) &&
    (!canViewAccessoryField('unit') || formData.value.unit_id) &&
    formData.value.supplier_id &&
    typeof formData.value.purchase_cost === 'number' && Number.isFinite(formData.value.purchase_cost) && formData.value.purchase_cost >= 0 &&
    (isColorStockIn.value ? colorStockQuantity.value > 0 : formData.value.serial_tracking === 1 ? serialEntries.value.length > 0 : formData.value.total_quantity > 0) &&
    formData.value.store_id
  )
})

// 图片上传配置
const uploadUrl = computed(() => {
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'
  return `${apiBaseUrl}/accessories/upload`
})

const uploadHeaders = computed(() => {
  const authData = storage.getAuth()
  const token = authStore.token || authData?.token || null
  return {
    Authorization: token ? `Bearer ${token}` : ''
  }
})

// 图片上传验证
const beforeImageUpload = (file: UploadRawFile): boolean => {
  const isImage = file.type.startsWith('image/')
  const isLt2M = file.size / 1024 / 1024 < 2

  if (!isImage) {
    globalNotifications.error('只能上传图片文件！')
    return false
  }
  if (!isLt2M) {
    globalNotifications.error('图片大小不能超过 2MB！')
    return false
  }
  return true
}

// 图片上传成功
const handleImageSuccess = (response: AccessoryImageUploadResponse): void => {
  if (response.success && response.data?.url) {
    formData.value.image_url = response.data.url
    if (!uploadedTempImages.value.includes(response.data.url)) {
      uploadedTempImages.value.push(response.data.url)
    }
    globalNotifications.success('图片上传成功')
  } else {
    globalNotifications.error('图片上传失败')
  }
}

// 图片上传失败
const handleUploadError = () => {
  globalNotifications.error('图片上传失败，请重试')
}

// 触发上传
const triggerUpload = () => {
  if (existingAccessory.value) return
  const uploadInput = document.querySelector<HTMLInputElement>('.image-uploader input[type="file"]')
  uploadInput?.click()
}

// 公共资料统一读取；手机型号只加载当前适配品牌，并丢弃过期响应。
const loadOptions = async () => {
  const requestId = ++optionsRequestId
  optionsLoading.value = true
  optionsReady.value = false
  try {
    const response = await getAccessoryEntryOptions({ accessory_id: formData.value.accessory_id || undefined })
    if (requestId !== optionsRequestId || !visible.value || !response.data) return
    const options = response.data
    optionsReady.value = true
    filmReady.value = options.film_ready === true
    categories.value = options.categories.map(normalizeAccessoryOption)
    units.value = options.units.map(normalizeAccessoryOption)
    brands.value = options.brands.map(normalizeAccessoryOption)
    modelBrands.value = options.model_brands.map(normalizeAccessoryOption)
    colors.value = options.colors.map(normalizeAccessoryOption)
    for (const variant of persistedTemplateColors.value) {
      if (variant.color_name && !colors.value.some(color => color.id === variant.color_id)) colors.value.push({ id: variant.color_id, name: variant.color_name })
    }
    suppliers.value = options.suppliers.map(normalizeAccessoryOption)
    stores.value = options.stores.map(store => ({
      id: Number(store.id), name: String(store.name || '')
    }))
    if (!stores.value.some(store => store.id === formData.value.store_id)) {
      formData.value.store_id = stores.value.find(store => store.id === options.default_store_id)?.id || stores.value.find(store => store.id === Number(authStore.user?.store_id))?.id || stores.value[0]?.id || null
    }
  } catch (err) {
    if (requestId !== optionsRequestId || !visible.value) return
    optionsReady.value = false
    logger.error('加载配件入库资料失败', err)
    globalNotifications.error(getRequestErrorMessage(err, '加载入库资料失败，请关闭后重试'))
  } finally {
    if (requestId === optionsRequestId) optionsLoading.value = false
  }
}

const loadModels = async () => {
  const requestId = ++modelRequestId
  models.value = []
  if (!canViewAccessoryField('model_name') || (!modelBrandId.value && !formData.value.model_ids.length)) {
    modelsLoading.value = false
    return
  }
  modelsLoading.value = true
  try {
    const response = await getAccessoryEntryOptions({
      brand_id: modelBrandId.value || undefined,
      accessory_id: formData.value.accessory_id || undefined,
      model_ids: formData.value.model_ids
    })
    if (requestId !== modelRequestId || !visible.value) return
    models.value = (response.data?.models || []).map(normalizeAccessoryOption)
  } catch (err) {
    if (requestId !== modelRequestId || !visible.value) return
    logger.error('加载适配型号失败', err)
    globalNotifications.error(getRequestErrorMessage(err, '加载适配型号失败'))
  } finally {
    if (requestId === modelRequestId) modelsLoading.value = false
  }
}

const applyAccessory = (accessory: AccessoryRecord) => {
  hydrating = true
  const stockColor = isStockInMode.value && accessory.color_variants?.length === 1 ? accessory.color_variants[0] : undefined
  const value = <T,>(field: AccessoryFieldName, input: T, fallback: T): T => canViewAccessoryField(field) ? input : fallback
  Object.assign(formData.value, {
    color_variants: canViewAccessoryField('color_name') ? (accessory.color_variants?.length ? accessory.color_variants
      : isEditMode.value && accessory.color_id ? [{ color_id: Number(accessory.color_id), barcode: accessory.barcode }] : []).map(row => ({ color_id: row.color_id,
      barcode: canViewAccessoryField('barcode') ? row.barcode || '' : '' })) : [],
    accessory_id: stockColor && !accessory.template_id ? stockColor.accessory_id : accessory.id, id: accessory.id,
    barcode: value('barcode', stockColor ? stockColor.barcode || '' : accessory.barcode || '', ''),
    name: value('name', accessory.name || '', ''),
    category: value('category', accessory.category || '', ''),
    category_id: value('category', Number(accessory.category_id) || null, null),
    product_model: value('product_model', accessory.product_model || '', ''),
    free_film: value('free_film', Number(accessory.free_film || 0), 0),
    serial_tracking: value('serial_tracking', Number(accessory.serial_tracking || 0), 0),
    brand_id: value('brand_name', Number(accessory.brand_id) || null, null),
    model_id: value('model_name', Number(accessory.model_id) || null, null),
    model_ids: value('model_name', Array.isArray(accessory.model_ids)
      ? accessory.model_ids.map(Number)
      : String(accessory.model_ids || (accessory.model_id ? accessory.model_id : '')).split(',').filter(Boolean).map(Number), []),
    color_id: value('color_name', Number(stockColor?.color_id || accessory.color_id) || null, null),
    supplier_id: value('supplier_name', Number(accessory.supplier_id) || null, null),
    purchase_cost: value('purchase_cost', Number(accessory.purchase_cost || 0), 0),
    sale_price: value('sale_price', Number(accessory.sale_price || 0), 0),
    unit: value('unit', accessory.unit || '个', '个'),
    unit_id: value('unit', Number(accessory.unit_id) || null, null),
    status: value('status', Number(accessory.status) === 0 ? 0 : 1, 1),
    min_stock: value('min_stock', Number(accessory.min_stock ?? 5), 5),
    image_url: value('image_url', accessory.image_url || '', ''),
    remarks: value('remarks', accessory.remarks || '', '')
  })
  modelBrandId.value = value('model_name', Number(accessory.model_brand_id) || null, null)
  hydrating = false
}

const fillStockInTemplate = async (accessory: AccessoryRecord, isLatest: () => boolean) => {
  if (canViewAccessoryField('status') && accessory.status !== undefined && Number(accessory.status) !== 1) {
    globalNotifications.warning('该商品模板已停用，请选择启用的模板')
    return
  }
  const supplierId = formData.value.supplier_id
  const purchaseCost = formData.value.purchase_cost
  const brandId = formData.value.brand_id
  if (existingAccessory.value?.id !== accessory.id) {
    if (serialEntries.value.length || serialBatchInput.value.trim() || colorStockRows.value.some(row => row.serialInput.trim() || Number(row.quantity) > 0)) {
      const confirmed = await globalNotifications.confirm('切换商品模板将清空已录入的数量和SN，是否继续？', '切换商品模板')
      if (!confirmed || !isLatest() || !visible.value) return
    }
    clearSerialRows()
    resetColorStockRows(accessory)
  }
  existingAccessory.value = accessory
  applyAccessory(accessory)
  formData.value.supplier_id = supplierId
  formData.value.purchase_cost = purchaseCost
  formData.value.brand_id = brandId
  await loadOptions()
  if (!isLatest() || !visible.value) return
  await loadModels()
}

const selectTemplate = async (id: number) => {
  if (isFixedTemplate.value || !Number.isSafeInteger(id) || id <= 0) return
  const request = accessorySelectionRequest.nextRequest()
  searching.value = true
  try {
    const response = await unifiedApi.get<AccessoryRecord>(`/accessories/${id}`, {
      signal: request.signal, useCache: false
    })
    if (!request.isLatest() || !visible.value || !response.data) return
    await fillStockInTemplate(response.data, request.isLatest)
  } catch (err) {
    if (!request.isLatest() || accessorySelectionRequest.isCanceledError(err)) return
    logger.error('读取商品模板失败', err)
  } finally {
    if (request.isLatest()) searching.value = false
  }
}

// 提交
const handleSubmit = async () => {
  if (submitting.value || (isStockInMode.value && purchaseStore.submitting)) return
  if (pendingCorrection.value) { await submitCorrection(); return }
  const isPurchase = isStockInMode.value
  if (!requirePermission(isPurchase ? 'stock-in' : isEditMode.value ? 'edit' : 'create')) return
  const actorId = purchaseActorId.value
  let purchaseInput: AccessoryStockInRequest | undefined
  if (pendingStockIn.value ? !canRetryStockIn.value : !canSubmit.value) {
    globalNotifications.warning(isEditMode.value || props.archiveOnly ? '请完善商品档案' : '请完善入库信息')
    return
  }

  if (isPurchase && !pendingStockIn.value && !formData.value.store_id) {
    globalNotifications.warning('请选择入库门店')
    return
  }
  submitting.value = true
  if (isPurchase) purchaseStore.submitting = true
  try {
    if (!pendingStockIn.value && !props.archiveOnly && formRef.value && !await formRef.value.validate().catch(() => false)) return
    if (isCorrectionMode.value) {
      const payload = pickVisibleAccessoryFields(buildAccessoryStockCorrectionPayload({
        ...formData.value,
        total_quantity: formData.value.serial_tracking === 1 ? serialEntries.value.length : formData.value.total_quantity,
        serial_numbers: formData.value.serial_tracking === 1 ? serialEntries.value : []
      }), accessoryPayloadFieldMap)
      pendingCorrection.value = { ...payload, request_key: createCheckoutKey() }
      await submitCorrection()
      return
    } else if (isEditMode.value) {
      const templatePayload = buildAccessoryUpdatePayload(templatePayloadSource())
      delete templatePayload.purchase_cost
      delete templatePayload.supplier_id
      if (!props.profileEditOnly && !props.accessory?.template_id) delete templatePayload.brand_id
      const updateData = pickVisibleAccessoryFields(templatePayload, accessoryPayloadFieldMap)
      const response = await unifiedApi.put(`/accessories/${formData.value.id}`, updateData)
      if (!response.success) throw new Error(response.message || '更新模板失败')
      globalNotifications.success('更新成功！')
    } else if (props.archiveOnly) {
      const archivePayload = buildAccessoryUpdatePayload(templatePayloadSource())
      delete archivePayload.purchase_cost
      delete archivePayload.supplier_id
      delete archivePayload.brand_id
      const archiveData = pickVisibleAccessoryFields(archivePayload, accessoryPayloadFieldMap)
      const response = await unifiedApi.post('/accessories', archiveData)
      if (!response.success) throw new Error(response.message || '创建模板失败')
      globalNotifications.success('商品模板创建成功！')
    } else {
      const stockPayload = (source: Parameters<typeof buildAccessoryStockInPayload>[0]) => pickVisibleAccessoryFields(buildAccessoryStockInPayload(source), accessoryPayloadFieldMap)
      const data = isColorStockIn.value ? { entries: colorStockRows.value.filter(row => formData.value.serial_tracking === 1
        ? colorSerials(row).length > 0 : Number(row.quantity) > 0).map(row => stockPayload({
        ...formData.value, accessory_id: row.accessory_id, color_id: row.color_id, barcode: row.barcode,
        total_quantity: formData.value.serial_tracking === 1 ? colorSerials(row).length : row.quantity,
        serial_numbers: formData.value.serial_tracking === 1 ? colorSerials(row).map(serial_number => ({ serial_number, store_id: Number(formData.value.store_id) })) : undefined,
        distribution: []
      })) } : stockPayload({
        ...formData.value,
        total_quantity: formData.value.serial_tracking === 1 ? serialEntries.value.length : formData.value.total_quantity,
        serial_numbers: formData.value.serial_tracking === 1 ? serialEntries.value : undefined,
        distribution: []
      })

      purchaseInput = purchaseStore.prepare(actorId, data)
      await fieldPermissions.init()
      if (purchaseActorId.value !== actorId || !canRetryStockIn.value) throw new Error('入库账号或字段权限已变化，请重新核对权限后重试原入库')
      const response = await unifiedApi.post<AccessoryStockInReceipt | AccessoryColorStockInReceipt>('/accessories/stock-in', purchaseInput)
      const valid = 'entries' in purchaseInput ? isAccessoryColorStockInReceipt(response.data, purchaseInput.entries.length) : isAccessoryStockInReceipt(response.data)
      if (!response.success || !valid || !response.data) throw new Error('入库回执未确认，请重试原入库核对结果')
      purchaseStore.complete(actorId, purchaseInput.request_key)
      if (purchaseActorId.value !== actorId) return
      globalNotifications.success(response.data.replayed ? '已核对原采购入库，未重复入库！' : '入库成功！')
    }
    uploadedTempImages.value = []
    visible.value = false
    emit('success')
  } catch (err) {
    const code = getRequestErrorPayload(err)?.code
    // 仅服务端明确拒绝且未提交的业务错误可释放原请求；网络/5xx/结构缺失继续保留。
    if (purchaseInput && getRequestErrorStatus(err) === 400 && typeof code === 'string' &&
      ['VALIDATION_ERROR', 'INVALID_REFERENCE', 'NOT_FOUND', 'DUPLICATE_SERIAL', 'SERIAL_STORE_MISMATCH', 'SERIAL_DISTRIBUTION_MISMATCH'].includes(code)) {
      try { purchaseStore.complete(actorId, purchaseInput.request_key) }
      catch (storageError) { logger.error('无法清理已拒绝入库的防重凭据，保留原请求供重试', storageError) }
    }
    logger.error(isEditMode.value ? '更新失败' : '入库失败', err)
    globalNotifications.error(getRequestErrorMessage(err, `${isEditMode.value ? '更新失败' : props.archiveOnly ? '创建档案失败' : '入库失败'}，请重试`))
  } finally {
    submitting.value = false
    if (isPurchase) purchaseStore.submitting = false
  }
}

const handleDialogClose = async () => {
  await cleanupTempImages()
  resetFormData()
  resetCorrection()
}

const handleClose = () => {
  if (submitting.value) return
  visible.value = false
}

const cleanupTempImages = async () => {
  if (uploadedTempImages.value.length === 0) return
  const targets = [...uploadedTempImages.value]
  const success = await deleteTempFiles(targets)
  if (success) {
    uploadedTempImages.value = uploadedTempImages.value.filter(url => !targets.includes(url))
  }
}

const resetFormData = () => {
  templateSearchRequest.cancelLatest()
  templateResults.value = []
  templatePage.value = 1
  templateTotal.value = 0
  templateKeyword.value = ''
  templateError.value = ''
  templatesLoading.value = false
  accessorySelectionRequest.cancelLatest()
  searching.value = false
  formData.value = {
    inventory_time: TimeUtil.nowFormatted(TIME_FORMATS.DATETIME),
    color_variants: [],
    barcode: '',
    accessory_id: null,
    id: null,
    name: '',
    category: '',
    category_id: null,
    product_model: '',
    serial_tracking: 0,
    free_film: 0,
    usage_type: 'sale' as AccessoryUsageType,
    brand_id: null,
    model_id: null,
    model_ids: [],
    color_id: null,
    supplier_id: null,
    purchase_cost: 0,
    sale_price: 0,
    unit: '个',
    unit_id: null,
    status: 1,
    min_stock: 5,
    image_url: '',
    total_quantity: 1,
    store_id: null,
    remarks: ''
  }
  existingAccessory.value = null
  resetColorStockRows()
  colorSerialScanTarget.value = null
  clearSerialRows()
  hydrating = true
  modelBrandId.value = null
  hydrating = false
  models.value = []
  uploadedTempImages.value = []

}

watch(() => [isEntryMode.value, formData.value.serial_tracking] as const, ([stockIn, tracking]) => {
  serialScannerVisible.value = false
  if (stockIn && tracking === 1 && !serialRows.value.length) serialRows.value.push({ id: ++nextSerialRowId, value: '' })
})

watch(modelBrandId, brandId => {
  if (hydrating) return
  if (!brandId) {
    formData.value.model_ids = []
    formData.value.model_id = null
  }
  void loadModels()
}, { flush: 'sync' })

watch(() => props.modelValue, async isOpen => {
  if (!isOpen) {
    serialScannerVisible.value = false
    correctionRequests.cancelLatest()
    correctionOptionsRequests.cancelLatest()
    optionsRequestId++
    modelRequestId++
    templateSearchRequest.cancelLatest()
    templatesLoading.value = false
    accessorySelectionRequest.cancelLatest()
    searching.value = false
    return
  }
  await fieldPermissions.init()
  if (!visible.value) return
  recoveryError.value = ''
  if (isStockInMode.value) {
    try { purchaseStore.load(purchaseActorId.value) }
    catch (error) { recoveryError.value = getRequestErrorMessage(error) }
  }
  resetFormData()
  resetCorrection()
  if (isCorrectionMode.value) {
    await loadCorrectionOptions()
    return
  }
  if (props.accessory?.id) {
    applyAccessory(props.accessory)
    if (props.stockInOnly) {
      existingAccessory.value = props.accessory
      resetColorStockRows(props.accessory)
      formData.value.supplier_id = null
      formData.value.purchase_cost = 0
      if (!props.accessory.template_id) {
        formData.value.brand_id = null
      }
    }
  }
  await loadOptions()
  await loadModels()
}, { immediate: true })

watch(() => [purchaseActorId.value, canEditStock.value, canView.value,
  ...Object.values(accessoryPayloadFieldMap).map(canViewAccessoryField)], (current, previous) => {
  if (current.every((value, index) => Object.is(value, previous[index]))) return
  if (!isCorrectionMode.value || !visible.value || !(correctionOptionsLoading.value || correctionLoading.value || correctionContext.value || pendingCorrection.value)) return
  resetCorrection()
  resetFormData()
  correctionError.value = '账号或字段权限已变化，请关闭后重新核对商品库存'
})
</script>

<style scoped src="./styles/accessory-stock-in-modal/form.css"></style>
<style scoped src="./styles/accessory-stock-in-modal/responsive.css"></style>
