import Link from 'next/link'
import { Wind, ArrowRight, Shield, Cloud, Truck, BarChart3 } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-wind-900">
      {/* Hero */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-wind-700/10 to-transparent" />
        <div className="relative max-w-5xl mx-auto px-4 pt-16 pb-20 text-center">
          {/* Logo */}
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-wind-700 mb-6">
            <Wind className="h-9 w-9 text-white" />
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight mb-4">
            Wind<span className="text-accent">Lift</span>
          </h1>
          <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto mb-8">
            Rüzgar türbini montaj firmalarına özel proje yönetimi, montaj planlama
            ve saha ilerleme takibi platformu.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/login" className="btn-primary text-base px-6 py-3">
              Giriş Yap
              <ArrowRight className="h-5 w-5" />
            </Link>
            <Link href="/register" className="btn-secondary text-base px-6 py-3">
              Ücretsiz Dene
            </Link>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <FeatureCard
            icon={<Wind className="h-6 w-6" />}
            title="Montaj Planlama"
            description="Türbin bazında lift plan, vinç seçimi ve rüzgar penceresi hesaplama."
          />
          <FeatureCard
            icon={<Cloud className="h-6 w-6" />}
            title="Hava Durumu"
            description="Saatlik rüzgar tahmini, Go/No-Go matrisi ve çalışma penceresi analizi."
          />
          <FeatureCard
            icon={<Truck className="h-6 w-6" />}
            title="Kaynak Yönetimi"
            description="Vinç ve ekip takibi, mobilizasyon planlama ve müsaitlik takvimi."
          />
          <FeatureCard
            icon={<BarChart3 className="h-6 w-6" />}
            title="Raporlama"
            description="Proje ilerlemesi, hava durumu analizi ve kaynak kullanım raporları."
          />
        </div>

        {/* Trust */}
        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-2 text-sm text-gray-500">
            <Shield className="h-4 w-4" />
            Verileriniz güvende — Supabase ile uçtan uca şifreleme
          </div>
        </div>
      </div>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="card">
      <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-wind-700/20 text-wind-400 mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-gray-100 mb-2">{title}</h3>
      <p className="text-sm text-gray-400">{description}</p>
    </div>
  )
}
