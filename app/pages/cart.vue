<script setup lang="ts">
definePageMeta({ middleware: 'catalog' })

const { t, locale } = useI18n()
const localePath = useLocalePath()
const cart = useCart()
const session = useAuthSession()

const signedIn = computed(() => Boolean(session.value.data?.user))

// Signed in, or told us to go ahead without an account. Until one of the two is
// true there is nothing to ask for an address into.
const asGuest = ref(false)
const email = ref('')

const identified = computed(() => signedIn.value || asGuest.value)
const emailLooksReal = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim()))
const canPay = computed(() =>
  consent.value && (signedIn.value || (asGuest.value && emailLooksReal.value)))

const consent = ref(false)
const busy = ref(false)
const problem = ref('')
const paying = ref(false)
const done = ref(false)

const holder = ref<HTMLElement | null>(null)
let elements: { submit: () => Promise<void> } | null = null

const money = (minor: number) => new Intl.NumberFormat(locale.value, {
  style: 'currency',
  currency: 'EUR',
}).format(minor / 100)

// Priced once in the composable and shared, so this page and the navbar's
// popover never disagree about what is in the cart.
onMounted(() => cart.reprice())

useHead({ script: [{ src: 'https://js.stripe.com/v3/', async: true }] })

function whenStripeReady(): Promise<any> {
  return new Promise((resolve, reject) => {
    const started = Date.now()
    const tick = () => {
      const global = (window as any).Stripe
      if (global) return resolve(global)
      if (Date.now() - started > 15_000) return reject(new Error(t('cart.failed')))
      setTimeout(tick, 100)
    }
    tick()
  })
}

// Two steps on purpose: the intent is created first so a refused cart or a
// missing consent comes back as our own message, and only then does the payment
// form appear.
async function startPayment() {
  busy.value = true
  problem.value = ''

  try {
    const res = await $fetch<{ clientSecret: string, publishableKey: string }>(
      '/api/catalog/checkout',
      {
        method: 'POST',
        body: {
          items: cart.items.value,
          consent: consent.value,
          ...(signedIn.value ? {} : { email: email.value.trim() }),
        },
      },
    )

    const Stripe = await whenStripeReady()
    const stripe = Stripe(res.publishableKey)
    const group = stripe.elements({ clientSecret: res.clientSecret })
    const payment = group.create('payment')

    await nextTick()
    payment.mount(holder.value)
    paying.value = true

    elements = {
      submit: async () => {
        const { error } = await stripe.confirmPayment({
          elements: group,
          confirmParams: { return_url: `${location.origin}${localePath('/library')}` },
          redirect: 'if_required',
        })

        if (error) throw new Error(error.message || t('cart.failed'))

        // Entitlements are written by the webhook, not here, so the library may
        // be a moment behind. Clearing the cart is safe either way: the payment
        // is taken and the sale is recorded against it.
        cart.clear()
        done.value = true
      },
    }
  }
  catch (e: any) {
    problem.value = e?.data?.statusMessage || e?.message || t('cart.failed')
  }
  finally {
    busy.value = false
  }
}

async function confirm() {
  busy.value = true
  problem.value = ''
  try {
    await elements?.submit()
  }
  catch (e: any) {
    problem.value = e?.message || t('cart.failed')
  }
  finally {
    busy.value = false
  }
}

useSeoMeta({ title: () => t('cart.title'), robots: 'noindex' })
</script>

<template>
  <div>
    <Navbar />

    <div class="relative">
      <div class="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[420px] bg-[url('/bg.webp')] bg-cover bg-center mask-b-from-30% mask-b-to-100%"></div>

      <section class="container mx-auto max-w-2xl px-4 pb-24 pt-40">
        <h1 class="text-3xl font-semibold tracking-tight">{{ t('cart.title') }}</h1>

        <UAlert
          v-if="problem"
          color="error"
          variant="subtle"
          class="mt-6 rounded-2xl"
          icon="i-pixelarticons-warning-box"
          :description="problem"
        />

        <div v-if="done" class="mt-8 rounded-2xl border border-default p-6 text-center">
          <p class="font-medium">{{ t('cart.done') }}</p>
          <UButton class="mt-4 rounded-xl" :to="localePath('/library')" :label="t('cart.toLibrary')" />
        </div>

        <div v-else-if="!cart.lines.value.length" class="mt-8 text-muted">
          {{ t('cart.empty') }}
        </div>

        <div v-else class="mt-8 space-y-6">
          <ul class="divide-y divide-default rounded-2xl border border-default">
            <li v-for="line in cart.lines.value" :key="line.projectId" class="flex items-center gap-3 p-4">
              <img v-if="line.icon" :src="line.icon" alt="" class="size-10 rounded-lg" />
              <NuxtLink :to="localePath(line.path)" class="flex-1 font-medium hover:underline">
                {{ line.title }}
              </NuxtLink>
              <span>{{ money(line.priceMinor) }}</span>
              <UButton
                variant="ghost"
                color="neutral"
                icon="i-pixelarticons-close"
                :disabled="paying"
                @click="cart.remove(line.projectId)"
              />
            </li>
          </ul>

          <div class="flex items-center justify-between text-lg font-medium">
            <span>{{ t('cart.total') }}</span>
            <span>{{ money(cart.totalMinor.value) }}</span>
          </div>

          <template v-if="!paying">
            <!-- An account is not needed to buy. Whoever does not want one says
                 so here, and then the receipt is the only copy of the purchase
                 they get - which is why the address is asked for and not
                 optional. -->
            <div v-if="!identified" class="rounded-2xl border border-default p-5">
              <p class="font-medium">{{ t('cart.identify') }}</p>
              <p class="mt-1 text-sm text-muted">{{ t('cart.identifyHint') }}</p>

              <div class="mt-4 flex flex-wrap gap-3">
                <UButton
                  class="rounded-xl"
                  :label="t('cart.asGuest')"
                  @click="asGuest = true"
                />
                <UButton
                  variant="subtle"
                  color="neutral"
                  class="rounded-xl"
                  :label="t('cart.signIn')"
                  :to="localePath('/login') + `?next=${encodeURIComponent(localePath('/cart'))}`"
                />
              </div>
            </div>

            <template v-else>
              <UFormField
                v-if="!signedIn"
                :label="t('cart.email')"
                :help="t('cart.emailHint')"
              >
                <UInput v-model="email" type="email" class="w-full" placeholder="you@example.com" />
              </UFormField>

              <!-- Unchecked by default and required: a waiver nobody actively
                   gave is not a waiver, and pre-ticking it would make it
                   worthless. -->
              <UCheckbox v-model="consent" :label="t('cart.consent')" />

              <UButton
                class="rounded-xl"
                :loading="busy"
                :disabled="!canPay"
                :label="t('cart.pay', { amount: money(cart.totalMinor.value) })"
                @click="startPayment()"
              />
            </template>
          </template>

          <template v-else>
            <div ref="holder"></div>
            <UButton
              class="rounded-xl"
              :loading="busy"
              :label="t('cart.confirm')"
              @click="confirm()"
            />
          </template>
        </div>
      </section>
    </div>
  </div>
</template>
