package co.median.android.icons;

import android.content.Context;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.Drawable;

import androidx.appcompat.content.res.AppCompatResources;
import androidx.core.graphics.drawable.DrawableCompat;

import co.median.android.R;

/**
 * Minimal local icon fallback for fresh debug setups.
 * It keeps the shell compilable before the full Median icon package is wired in.
 */
public class Icon {
    private final Context context;
    private final int size;
    private final int color;

    public Icon(Context context, String name, int size, int color) {
        this.context = context;
        this.size = size;
        this.color = color;
    }

    public Drawable getDrawable() {
        Drawable drawable = AppCompatResources.getDrawable(context, R.drawable.ic_share);
        if (drawable == null) {
            drawable = new ColorDrawable(color);
        }
        drawable = DrawableCompat.wrap(drawable.mutate());
        DrawableCompat.setTint(drawable, color);
        drawable.setBounds(0, 0, size, size);
        return drawable;
    }
}
