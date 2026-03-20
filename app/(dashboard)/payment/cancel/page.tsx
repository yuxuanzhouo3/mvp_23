"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function PaymentCancelPage() {
  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>支付已取消</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            你已取消本次支付，可以随时返回支付中心重新下单。
          </p>
          <Button asChild className="w-full">
            <Link href="/checkout">返回支付中心</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
