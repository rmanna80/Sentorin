/*
 * Sentorin pen firmware, v1 beacon.
 *
 * Advertises (scannable, non-connectable) so the owner's phone can find it:
 *   advertising data : flags, Sentorin 128-bit service UUID, manufacturer data = battery mV
 *   scan response    : complete name "STN-<public id>"
 * The phone app (app/src/PenScreen.tsx) filters on the UUID and matches the name.
 *
 * NOT YET IMPLEMENTED (see firmware/README.md): rotating private identifiers,
 * authenticated provisioning / ownership transfer, unwanted-tracking protections.
 */
#include <zephyr/kernel.h>
#include <zephyr/bluetooth/bluetooth.h>
#include <zephyr/bluetooth/uuid.h>
#include <zephyr/drivers/adc.h>
#include <nrfx.h>
#include <string.h>

#define SENTORIN_UUID BT_UUID_128_ENCODE(0x7e570001, 0x5a4e, 0x4f52, 0x8a11, 0x53454e544f52)
#define PUBLIC_ID_LEN 8
#define BATTERY_PERIOD K_MINUTES(10)
#define ADV_UNITS(ms) ((ms) * 1000 / 625)

static const struct adc_dt_spec vdd_adc = ADC_DT_SPEC_GET(DT_PATH(zephyr_user));

static char adv_name[4 + PUBLIC_ID_LEN + 1] = "STN-";
static uint8_t mfg_data[4] = { 0xff, 0xff, 0x00, 0x00 }; /* 0xFFFF = test company ID; then battery mV, little endian */

static const struct bt_data ad[] = {
	BT_DATA_BYTES(BT_DATA_FLAGS, BT_LE_AD_GENERAL | BT_LE_AD_NO_BREDR),
	BT_DATA_BYTES(BT_DATA_UUID128_ALL, SENTORIN_UUID),
	BT_DATA(BT_DATA_MANUFACTURER_DATA, mfg_data, sizeof(mfg_data)),
};
static struct bt_data sd[] = {
	BT_DATA(BT_DATA_NAME_COMPLETE, adv_name, 0), /* length filled in at start-up */
};

/* The public ID is written to UICR CUSTOMER[0..1] at the factory (8 ASCII characters). */
static void load_public_id(void)
{
	char id[PUBLIC_ID_LEN + 1] = { 0 };
	uint32_t words[2] = { NRF_UICR->CUSTOMER[0], NRF_UICR->CUSTOMER[1] };

	if (words[0] != 0xffffffff) {
		memcpy(id, words, PUBLIC_ID_LEN);
	} else {
		strncpy(id, CONFIG_SENTORIN_PUBLIC_ID, PUBLIC_ID_LEN);
	}
	strncat(adv_name, id, PUBLIC_ID_LEN);
	sd[0].data_len = strlen(adv_name);
}

static int read_vdd_mv(void)
{
	int16_t raw = 0;
	struct adc_sequence seq = { .buffer = &raw, .buffer_size = sizeof(raw) };
	int32_t mv;

	adc_sequence_init_dt(&vdd_adc, &seq);
	if (adc_read_dt(&vdd_adc, &seq) < 0) {
		return -1;
	}
	mv = raw;
	if (adc_raw_to_millivolts_dt(&vdd_adc, &mv) < 0) {
		return -1;
	}
	return mv;
}

static int start_adv(int interval_ms)
{
	struct bt_le_adv_param param = BT_LE_ADV_PARAM_INIT(BT_LE_ADV_OPT_SCANNABLE | BT_LE_ADV_OPT_USE_IDENTITY,
							    ADV_UNITS(interval_ms), ADV_UNITS(interval_ms) + 16, NULL);

	return bt_le_adv_start(&param, ad, ARRAY_SIZE(ad), sd, ARRAY_SIZE(sd));
}

int main(void)
{
	bool slow = false;

	load_public_id();
	if (!adc_is_ready_dt(&vdd_adc) || adc_channel_setup_dt(&vdd_adc) < 0) {
		return 0;
	}
	if (bt_enable(NULL) < 0) {
		return 0;
	}
	if (start_adv(CONFIG_SENTORIN_ADV_INTERVAL_MS) < 0) {
		return 0;
	}

	while (1) {
		int mv = read_vdd_mv();

		if (mv > 0) {
			bool want_slow = mv < CONFIG_SENTORIN_LOW_BATT_MV;

			mfg_data[2] = mv & 0xff;
			mfg_data[3] = (mv >> 8) & 0xff;
			if (want_slow != slow) {
				/* Nearly flat cells: advertise 5x less often to avoid brown-out resets. */
				slow = want_slow;
				bt_le_adv_stop();
				start_adv(CONFIG_SENTORIN_ADV_INTERVAL_MS * (slow ? 5 : 1));
			} else {
				bt_le_adv_update_data(ad, ARRAY_SIZE(ad), sd, ARRAY_SIZE(sd));
			}
		}
		k_sleep(BATTERY_PERIOD);
	}
	return 0;
}
