import { useEffect } from "react";
import { ArrowRightLeft, Info } from "lucide-react";

export default function BuyMassa() {
  useEffect(() => {
    // Load the Let's Exchange widget script
    const script = document.createElement("script");
    script.src = "https://letsexchange.io/init_widget.js";
    script.async = true;
    document.body.appendChild(script);

    // Load the widget CSS
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = "https://letsexchange.io/widget_lets.css";
    document.head.appendChild(link);

    return () => {
      // Cleanup
      document.body.removeChild(script);
      document.head.removeChild(link);
    };
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="brut-card bg-gradient-to-r from-blue-200 to-purple-200 p-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white rounded-xl border-3 border-ink-950">
            <ArrowRightLeft className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black">Buy Massa</h1>
            <p className="text-sm text-gray-700 mt-1">
              Exchange crypto to get MAS tokens instantly
            </p>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Widget Section */}
        <div className="lg:col-span-2">
          <div className="brut-card bg-white p-6">
            <h2 className="text-xl font-bold mb-4">Exchange Widget</h2>

            {/* Let's Exchange Widget */}
            <div className="flex justify-center">
              <div
                className="lets-widget"
                id="lets_widget_QPYvdD31xGml3V75"
                style={{ maxWidth: "480px", height: "480px" }}
              >
                <iframe
                  src="https://letsexchange.io/v2/widget?affiliate_id=QPYvdD31xGml3V75&is_iframe=true"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  allow="clipboard-read; clipboard-write"
                  title="Let's Exchange Widget"
                ></iframe>
              </div>
            </div>
          </div>
        </div>

        {/* Info Sidebar */}
        <div className="space-y-6">
          {/* How it Works */}
          <div className="brut-card bg-gradient-to-br from-green-50 to-emerald-50 p-6">
            <h3 className="font-black text-lg mb-3 flex items-center gap-2">
              <Info className="w-5 h-5" />
              How It Works
            </h3>
            <ul className="text-sm space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">1.</span>
                <span>Select the crypto you want to exchange</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">2.</span>
                <span>Choose MAS as the destination token</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">3.</span>
                <span>Enter your Massa wallet address</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">4.</span>
                <span>Complete the exchange instantly</span>
              </li>
            </ul>
          </div>

          {/* Why Buy MAS */}
          <div className="brut-card bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
            <h3 className="font-black text-lg mb-3">Why Buy MAS?</h3>
            <ul className="text-sm space-y-2">
              <li className="flex items-start gap-2">
                <div className="mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                </div>
                <span>Pay for transaction fees on Massa network</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                </div>
                <span>Invest in WMAS through your vaults</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                </div>
                <span>Participate in DeFi on Massa blockchain</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                </div>
                <span>Support the decentralized web (DeWeb)</span>
              </li>
            </ul>
          </div>

          {/* Quick Tips */}
          <div className="brut-card bg-gradient-to-br from-yellow-50 to-orange-50 p-6">
            <h3 className="font-black text-lg mb-3">💡 Quick Tips</h3>
            <ul className="text-sm space-y-2">
              <li className="flex items-start gap-2">
                <div className="mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-600"></div>
                </div>
                <span>Double-check your Massa address before confirming</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-600"></div>
                </div>
                <span>Exchange times vary based on network congestion</span>
              </li>
              <li className="flex items-start gap-2">
                <div className="mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-600"></div>
                </div>
                <span>Keep some MAS for gas fees when using the app</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
