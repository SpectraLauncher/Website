<script setup lang="ts">
const { t, locale } = useI18n()
const localePath = useLocalePath()
const cart = useCart()

const money = (minor: number) => new Intl.NumberFormat(locale.value, {
  style: 'currency',
  currency: 'EUR',
}).format(minor / 100)
</script>

<template>
  <!-- Nothing in the cart, nothing in the navigation. An icon that is empty
       nine visits out of ten is just another thing to look past. -->
  <UPopover v-if="cart.count.value > 0" mode="hover" :content="{ align: 'end' }">
    <UChip :text="cart.count.value" size="xl" color="primary">
      <UButton
        :to="localePath('/cart')"
        icon="i-pixelarticons-cart"
        variant="ghost"
        color="neutral"
        :aria-label="t('cart.title')"
      />
    </UChip>

    <template #content>
      <div class="w-72 p-3">
        <ul class="space-y-2">
          <li
            v-for="line in cart.lines.value"
            :key="line.projectId"
            class="flex items-center gap-2 text-sm"
          >
            <img v-if="line.icon" :src="line.icon" alt="" class="size-8 rounded-md" />
            <span class="flex-1 truncate">{{ line.title }}</span>
            <span class="text-muted">{{ money(line.priceMinor) }}</span>
          </li>
        </ul>

        <div class="mt-3 flex items-center justify-between border-t border-default pt-3 text-sm font-medium">
          <span>{{ t('cart.total') }}</span>
          <span>{{ money(cart.totalMinor.value) }}</span>
        </div>

        <UButton
          class="mt-3 w-full justify-center rounded-xl"
          :to="localePath('/cart')"
          :label="t('cart.open')"
        />
      </div>
    </template>
  </UPopover>
</template>
