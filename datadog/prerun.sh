#!/usr/bin/env bash

# Disable the Datadog Agent for datadog drain run machines
if [ "$DYNOTYPE" == "run" ]; then
  DISABLE_DATADOG_AGENT="true"
fi

# Comment out Datadog agent default host tags-- we have our own
sed -i 's/- dyno:/# - dyno:/' "$DATADOG_CONF"
sed -i 's/- dynotype:/# - dynotype:/' "$DATADOG_CONF"
