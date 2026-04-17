/**
 * 支付方式配置工具
 */

import { RegionConfig } from "@/lib/config/region";

export type PaymentMethod = "wechat" | "alipay" | "stripe" | "paypal";

export interface PaymentMethodConfig {
  label: string;
  color: string;
  icon: string;
}

const paymentMethodConfigs: Record<PaymentMethod, PaymentMethodConfig> = {
  wechat: {
    label: "微信支付",
    color: "bg-green-600",
    icon: "💚",
  },
  alipay: {
    label: "支付宝",
    color: "bg-blue-600",
    icon: "💙",
  },
  stripe: {
    label: "Stripe",
    color: "bg-purple-600",
    icon: "💳",
  },
  paypal: {
    label: "PayPal",
    color: "bg-yellow-600",
    icon: "🅿️",
  },
};

/**
 * 获取所有可用的支付方式（根据当前环境）
 */
export function getAvailablePaymentMethods(): PaymentMethod[] {
  return RegionConfig.payment.methods as PaymentMethod[];
}

/**
 * 获取指定支付方式的配置
 */
export function getPaymentMethodConfig(method: string): PaymentMethodConfig {
  return (
    paymentMethodConfigs[method as PaymentMethod] || {
      label: method,
      color: "bg-gray-600",
      icon: "💰",
    }
  );
}
